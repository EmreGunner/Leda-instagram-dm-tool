// @deno-types="jsr:@supabase/functions-js/edge-runtime.d.ts"
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Type declarations for Deno (available in Supabase Edge Functions runtime)
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

/**
 * Supabase Edge Function to process campaigns
 * Called by pg_cron on a schedule
 * 
 * This function calls the Next.js API endpoint to process all RUNNING campaigns
 */
Deno.serve(async (req: Request) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    console.log(
      `[${requestId}] Edge Function invoked at ${new Date().toISOString()}`
    );
    console.log(`[${requestId}] Request method: ${req.method}`);
    console.log(`[${requestId}] Request URL: ${req.url}`);

    // Log request headers (excluding sensitive data)
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = key.toLowerCase().includes("authorization")
        ? "[REDACTED]"
        : value;
    });
    console.log(
      `[${requestId}] Request headers:`,
      JSON.stringify(headers, null, 2)
    );

    // Get environment variables
    console.log(`[${requestId}] Checking environment variables...`);
    const backendUrl = Deno.env.get("NEXT_PUBLIC_BACKEND_URL");
    const internalApiSecret = Deno.env.get("INTERNAL_API_SECRET");

    console.log(
      `[${requestId}] NEXT_PUBLIC_BACKEND_URL: ${
        backendUrl ? "SET" : "NOT SET"
      }`
    );
    console.log(
      `[${requestId}] INTERNAL_API_SECRET: ${
        internalApiSecret ? "SET" : "NOT SET"
      }`
    );

    if (!backendUrl) {
      const error = "NEXT_PUBLIC_BACKEND_URL is not configured";
      console.error(`[${requestId}] ERROR: ${error}`);
      return new Response(
        JSON.stringify({
          success: false,
          error,
          requestId,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!internalApiSecret) {
      const error = "INTERNAL_API_SECRET is not configured";
      console.error(`[${requestId}] ERROR: ${error}`);
      return new Response(
        JSON.stringify({
          success: false,
          error,
          requestId,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Construct the Next.js API endpoint URL
    const apiUrl = `${backendUrl}/api/internal/process-campaigns`;
    console.log(`[${requestId}] Constructed API URL: ${apiUrl}`);

    // Call the Next.js API endpoint
    console.log(`[${requestId}] Making fetch request to Next.js API...`);
    const fetchStartTime = Date.now();

    let response: Response;
    try {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${internalApiSecret}`,
        },
        body: JSON.stringify({}),
      });

      const fetchDuration = Date.now() - fetchStartTime;
      console.log(`[${requestId}] Fetch completed in ${fetchDuration}ms`);
      console.log(
        `[${requestId}] Response status: ${response.status} ${response.statusText}`
      );
      console.log(
        `[${requestId}] Response headers:`,
        JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)
      );
    } catch (fetchError: any) {
      const fetchDuration = Date.now() - fetchStartTime;
      console.error(
        `[${requestId}] Fetch failed after ${fetchDuration}ms:`,
        fetchError
      );
      console.error(`[${requestId}] Fetch error name:`, fetchError?.name);
      console.error(`[${requestId}] Fetch error message:`, fetchError?.message);
      console.error(`[${requestId}] Fetch error stack:`, fetchError?.stack);

      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to call Next.js API: ${
            fetchError?.message || "Unknown fetch error"
          }`,
          errorType: fetchError?.name || "FetchError",
          requestId,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get response data
    console.log(`[${requestId}] Parsing response body...`);
    let data: any;
    try {
      const responseText = await response.text();
      console.log(
        `[${requestId}] Response body length: ${responseText.length} characters`
      );
      console.log(
        `[${requestId}] Response body preview: ${responseText.substring(
          0,
          500
        )}`
      );

      data = JSON.parse(responseText);
      console.log(`[${requestId}] Successfully parsed JSON response`);
    } catch (parseError: any) {
      console.error(`[${requestId}] Failed to parse response:`, parseError);
      console.error(`[${requestId}] Parse error:`, parseError?.message);
      data = {
        success: false,
        error: "Failed to parse response",
        parseError: parseError?.message,
      };
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[${requestId}] Edge Function completed in ${totalDuration}ms`);
    console.log(
      `[${requestId}] Returning response with status: ${
        response.ok ? 200 : response.status
      }`
    );

    // Return the response from Next.js API
    return new Response(
      JSON.stringify({
        ...data,
        edgeFunctionTimestamp: new Date().toISOString(),
        edgeFunctionDuration: `${totalDuration}ms`,
        requestId,
        backendUrl: backendUrl,
      }),
      {
        status: response.ok ? 200 : response.status,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    const totalDuration = Date.now() - startTime;
    console.error(
      `[${requestId}] Edge Function error after ${totalDuration}ms:`,
      error
    );
    console.error(`[${requestId}] Error name:`, error?.name);
    console.error(`[${requestId}] Error message:`, error?.message);
    console.error(`[${requestId}] Error stack:`, error?.stack);
    console.error(
      `[${requestId}] Error details:`,
      JSON.stringify(
        {
          name: error?.name,
          message: error?.message,
          cause: error?.cause,
        },
        null,
        2
      )
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Unknown error occurred",
        errorType: error?.name || "Error",
        requestId,
        timestamp: new Date().toISOString(),
        duration: `${totalDuration}ms`,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

