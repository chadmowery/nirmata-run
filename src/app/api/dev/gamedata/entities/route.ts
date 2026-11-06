import { NextResponse } from 'next/server';
import path from 'path';
import { access } from 'fs/promises';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { listJsonFiles, atomicWrite, resolveFilePath, errorResponse, regenerateTemplateIndex } from '../utils';
import { RawTemplateSchema } from '../schemas';
import { validateEcsRules } from '../ecs-rules';
import { COMPONENTS_REGISTRY } from '@shared/components';

const DIR = path.join(process.cwd(), 'src/game/entities/templates');

export async function GET() {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  const names = (await listJsonFiles(DIR)).filter((n) => n !== 'economy');
  return NextResponse.json({ items: names });
}

export async function POST(req: Request) {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  try {
    const body = await req.json();

    const parseResult = RawTemplateSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse(`Invalid entity template schema: ${parseResult.error.message}`, 400);
    }

    const filePath = resolveFilePath(DIR, body.name);
    if (!filePath) {
      return errorResponse('Invalid template name. Use lowercase alphanumeric with hyphens.', 400);
    }

    try {
      await access(filePath);
      return errorResponse(`Template '${body.name}' already exists`, 409);
    } catch {
      /* file doesn't exist — good */
    }

    // Component schemas validation
    if (body.components && typeof body.components === 'object') {
      const compMap = new Map(COMPONENTS_REGISTRY.map((c) => [c.key, c.schema]));
      for (const [compKey, compVal] of Object.entries(body.components)) {
        const schema = compMap.get(compKey);
        if (schema) {
          const compParsed = schema.safeParse(compVal);
          if (!compParsed.success) {
            return errorResponse(`Invalid component '${compKey}': ${compParsed.error.message}`, 400);
          }
        }
      }

      // ECS rules validation
      const ecsCheck = validateEcsRules(body.components as Record<string, unknown>);
      if (!ecsCheck.valid) {
        return errorResponse(`ECS Validation Failed: ${ecsCheck.errors.map((e) => e.message).join('; ')}`, 422);
      }
    }

    await atomicWrite(filePath, body);
    await regenerateTemplateIndex();

    return NextResponse.json({ success: true, name: body.name }, { status: 201 });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}
