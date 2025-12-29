import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from "crypto";
import { campaignService } from "@/lib/server/campaigns/campaign-service";
import { prisma } from "@/lib/server/prisma/client";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Internal API endpoint for processing campaigns
 * Called by Supabase Edge Function via pg_cron
 *
 * Authentication: Uses INTERNAL_API_SECRET token
 *
 * Route: /api/internal/process-campaigns
 */
export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  console.log(`[${requestId}] POST /api/internal/process-campaigns called`);
  console.log(`[${requestId}] Request method: ${request.method}`);
  console.log(`[${requestId}] Request URL: ${request.url}`);

  try {
    // Verify authentication token
    const authHeader = request.headers.get("authorization");
    const expectedSecret = process.env.INTERNAL_API_SECRET;

    console.log(`[${requestId}] Auth header present: ${!!authHeader}`);
    console.log(
      `[${requestId}] INTERNAL_API_SECRET configured: ${!!expectedSecret}`
    );

    if (!expectedSecret) {
      console.error(`[${requestId}] INTERNAL_API_SECRET is not configured`);
      return NextResponse.json(
        { success: false, error: "Server configuration error", requestId },
        {
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }

    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      console.warn(
        `[${requestId}] Unauthorized request - invalid or missing auth header`
      );
      return NextResponse.json(
        { success: false, error: "Unauthorized", requestId },
        {
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }

    console.log(
      `[${requestId}] Authentication successful, processing campaigns...`
    );

    // Find all RUNNING campaigns
    const runningCampaigns = await prisma.campaign.findMany({
      where: { status: "RUNNING" },
      select: {
        id: true,
        name: true,
        totalRecipients: true,
        sentCount: true,
        failedCount: true,
      },
      orderBy: { createdAt: "asc" },
    });

    console.log(
      `[${requestId}] Found ${runningCampaigns.length} running campaigns`
    );

    if (runningCampaigns.length === 0) {
      console.log(`[${requestId}] No running campaigns to process`);
      return NextResponse.json(
        {
          success: true,
          message: "No running campaigns to process",
          processed: 0,
          campaigns: [],
          timestamp: new Date().toISOString(),
          requestId,
        },
        {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }

    // Process each campaign sequentially
    const results = [];
    let totalProcessed = 0;
    let totalFailed = 0;

    for (const campaign of runningCampaigns) {
      try {
        console.log(`Processing campaign: ${campaign.name} (${campaign.id})`);

        await campaignService.processCampaign(campaign.id);

        // Get updated stats
        const updatedCampaign = await prisma.campaign.findUnique({
          where: { id: campaign.id },
          select: {
            sentCount: true,
            failedCount: true,
            status: true,
          },
        });

        results.push({
          campaignId: campaign.id,
          name: campaign.name,
          success: true,
          sentCount: updatedCampaign?.sentCount || 0,
          failedCount: updatedCampaign?.failedCount || 0,
          status: updatedCampaign?.status || "RUNNING",
        });

        totalProcessed++;
      } catch (error: any) {
        console.error(`Failed to process campaign ${campaign.id}:`, error);

        results.push({
          campaignId: campaign.id,
          name: campaign.name,
          success: false,
          error: error?.message || "Unknown error",
        });

        totalFailed++;
      }
    }

    console.log(
      `[${requestId}] Processing complete: ${totalProcessed} succeeded, ${totalFailed} failed`
    );

    return NextResponse.json(
      {
        success: true,
        message: `Processed ${totalProcessed} campaigns successfully, ${totalFailed} failed`,
        processed: totalProcessed,
        failed: totalFailed,
        total: runningCampaigns.length,
        campaigns: results,
        timestamp: new Date().toISOString(),
        requestId,
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  } catch (error: any) {
    console.error(`[${requestId}] Campaign processing error:`, error);
    console.error(`[${requestId}] Error stack:`, error?.stack);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to process campaigns",
        timestamp: new Date().toISOString(),
        requestId,
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  }
}

/**
 * GET endpoint for health check (optional)
 */
export async function GET(request: NextRequest) {
  // Verify authentication
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.INTERNAL_API_SECRET;

  if (
    !expectedSecret ||
    !authHeader ||
    authHeader !== `Bearer ${expectedSecret}`
  ) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      {
        status: 401,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  }

  // Return status of running campaigns
  try {
    const runningCampaigns = await prisma.campaign.findMany({
      where: { status: "RUNNING" },
      select: {
        id: true,
        name: true,
        totalRecipients: true,
        sentCount: true,
        failedCount: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        runningCampaigns: runningCampaigns.length,
        campaigns: runningCampaigns,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to fetch campaign status",
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
    },
  });
}

