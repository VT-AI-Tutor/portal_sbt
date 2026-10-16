export interface ReferenceItem {
  code: string;
  label: string;
  order: number;
}

export interface ReferenceListResponse {
  success: boolean;
  data: ReferenceItem[];
}
