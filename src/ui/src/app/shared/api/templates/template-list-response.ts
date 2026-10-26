export interface TemplateListItemResponse {
  readonly id: string;
  readonly name: string;
}

export interface TemplateListResponse {
  readonly items: readonly TemplateListItemResponse[];
}
