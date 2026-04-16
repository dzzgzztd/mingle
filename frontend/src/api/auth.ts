import { api } from "./axios";

export const register = (email: string, password: string, name?: string) =>
  api.post("/auth/register", { email, password, name });

export const login = async (email: string, password: string) => {
  const res = await api.post("/auth/login", { email, password });
  localStorage.setItem("token", res.data.token);
  return res.data.token as string;
};

export const logout = () => {
  localStorage.removeItem("token");
};
