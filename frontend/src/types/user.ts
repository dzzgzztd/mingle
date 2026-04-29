export interface User {
  id: number;
  email: string;
  name?: string;
  avatar_url?: string;
  role?: "user" | "admin" | string;
}
