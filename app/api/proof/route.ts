import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildProofPackView, executeProofTransaction } from '@/lib/proof/service';

const bodySchema = z.object({
  signalId: z.string().min(1),
  confirmTx: z.boolean(),
  proofSecret: z.string().min(1).optional()
});

export const dynamic = 'force-dynamic';

function invalidRequestResponse(issues: z.ZodIssue[]) {
  return NextResponse.json(
    {
      reason: 'invalid_request',
      issues: issues.map(({ code, message, path }) => ({ code, message, path }))
    },
    { status: 400 }
  );
}

export async function GET() {
  return NextResponse.json({
    proofPack: await buildProofPackView()
  });
}

export async function POST(request: Request) {
  const parsedBody = bodySchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return invalidRequestResponse(parsedBody.error.issues);
  }

  const result = await executeProofTransaction(parsedBody.data);
  return NextResponse.json(result.body, { status: result.httpStatus });
}
