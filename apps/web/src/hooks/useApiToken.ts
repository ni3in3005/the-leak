import { useAuth } from "@clerk/clerk-react";
import { useCallback } from "react";

export function useApiToken() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const getAccessToken = useCallback(async () => {
    if (!isLoaded || !isSignedIn) throw new Error("Not signed in");
    const token = await getToken();
    if (!token) throw new Error("Could not get auth token");
    return token;
  }, [getToken, isLoaded, isSignedIn]);

  return { getAccessToken, isLoaded, isSignedIn };
}
