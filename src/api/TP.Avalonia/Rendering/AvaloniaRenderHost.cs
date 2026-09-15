using global::Avalonia.Headless;

namespace TP.Avalonia.Rendering;

public sealed class AvaloniaRenderHost : IAsyncDisposable
{
    private readonly HeadlessUnitTestSession _session = HeadlessUnitTestSession.StartNew(
        typeof(RenderAppBuilder),
        AvaloniaTestIsolationLevel.PerAssembly);
    private readonly SemaphoreSlim _renderGate = new(1, 1);
    private readonly object _disposeLock = new();
    private Task? _disposeTask;
    private int _isClosing;

    public async Task<TResult> DispatchAsync<TResult>(
        Func<TResult> action,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(action);
        cancellationToken.ThrowIfCancellationRequested();
        ObjectDisposedException.ThrowIf(Volatile.Read(ref _isClosing) != 0, this);

        // The session does not cancel synchronous work while it is queued.
        // Submit one callback at a time and honor cancellation before submission.
        await _renderGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            ObjectDisposedException.ThrowIf(Volatile.Read(ref _isClosing) != 0, this);
            return await _session.Dispatch(() =>
            {
                cancellationToken.ThrowIfCancellationRequested();
                return action();
            }, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            _renderGate.Release();
        }
    }

    public ValueTask DisposeAsync()
    {
        lock (_disposeLock)
        {
            if (_disposeTask is null)
            {
                Volatile.Write(ref _isClosing, 1);
                _disposeTask = DisposeCoreAsync();
            }

            return new ValueTask(_disposeTask);
        }
    }

    private async Task DisposeCoreAsync()
    {
        // Finish the submitted callback before stopping the session consumer.
        await _renderGate.WaitAsync().ConfigureAwait(false);
        try
        {
            await _session.DisposeAsync().ConfigureAwait(false);
        }
        finally
        {
            // Existing waiters must wake and observe closing. No wait handle is used.
            _renderGate.Release();
        }
    }
}
