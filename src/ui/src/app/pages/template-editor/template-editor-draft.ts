import type { TemplateDetail } from '../../shared/api/templates/template-detail';

export const INITIAL_TEMPLATE_DRAFT: TemplateDetail = Object.freeze({
  id: null,
  name: 'Event invitation',
  template: `<Border xmlns="https://github.com/avaloniaui"
        Width="1200" Height="630" Background="#FFFFFF">
  <Grid>
    <TextBlock Text="You are invited" FontSize="64"
               FontWeight="Bold" Foreground="#242424"
               HorizontalAlignment="Center" VerticalAlignment="Center" />
  </Grid>
</Border>`,
});
