import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

// For local dev with vite proxy, we might not need base url if it's relative
setBaseUrl(import.meta.env.VITE_API_URL || "");

setAuthTokenGetter(() => {
  return localStorage.getItem("salon_token");
});
