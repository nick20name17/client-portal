export interface CreateTagPayload {
  name: string;
  color: string;
}

export interface UpdateTagPayload {
  name?: string;
  color?: string;
}
