import { httpApi } from "./http";
import { mockApi } from "./mock";

// Mock until NEXT_PUBLIC_API_BASE is set, or when forced with NEXT_PUBLIC_USE_MOCK=1.
const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "1" || !process.env.NEXT_PUBLIC_API_BASE;

export const api = useMock ? mockApi : httpApi;
export { ApiError } from "./types";
export type { Api, SocketStatus } from "./types";
