/**
 * AI Behavior Registry
 * Stores and manages static Behavior Tree ASTs and reusable Subtree Mixins.
 */

import { BehaviorTreeNode, BehaviorTreeNodeSchema } from '@shared/components/ai-tree';

import subtreesJson from '../entities/templates/ai/subtrees.json';
import nullPointerJson from '../entities/templates/ai/null-pointer.json';
import bufferOverflowJson from '../entities/templates/ai/buffer-overflow.json';
import fragmenterJson from '../entities/templates/ai/fragmenter.json';
import logicLeakerJson from '../entities/templates/ai/logic-leaker.json';
import systemAdminJson from '../entities/templates/ai/system-admin.json';
import seedEaterJson from '../entities/templates/ai/seed-eater.json';
import basicJson from '../entities/templates/ai/basic.json';

class AIBehaviorRegistryImpl {
  private trees = new Map<string, BehaviorTreeNode>();
  private subtrees = new Map<string, BehaviorTreeNode>();

  constructor() {
    this.loadDefaults();
  }

  public loadDefaults(): void {
    this.trees.clear();
    this.subtrees.clear();

    // 1. Load Subtrees
    for (const [key, rawNode] of Object.entries(subtreesJson)) {
      const parsed = BehaviorTreeNodeSchema.parse(rawNode);
      this.subtrees.set(key, parsed);
    }

    // 2. Load Archetype Trees
    const templates = [
      nullPointerJson,
      bufferOverflowJson,
      fragmenterJson,
      logicLeakerJson,
      systemAdminJson,
      seedEaterJson,
      basicJson,
    ];

    for (const t of templates) {
      const parsed = BehaviorTreeNodeSchema.parse(t.root);
      this.trees.set(t.id, parsed);
    }
  }

  public getTree(id: string): BehaviorTreeNode | undefined {
    return this.trees.get(id);
  }

  public getSubtree(ref: string): BehaviorTreeNode | undefined {
    return this.subtrees.get(ref);
  }

  public registerTree(id: string, root: BehaviorTreeNode): void {
    const validated = BehaviorTreeNodeSchema.parse(root);
    this.trees.set(id, validated);
  }

  public registerSubtree(ref: string, node: BehaviorTreeNode): void {
    const validated = BehaviorTreeNodeSchema.parse(node);
    this.subtrees.set(ref, validated);
  }

  public listTreeIds(): string[] {
    return Array.from(this.trees.keys());
  }

  public listSubtreeRefs(): string[] {
    return Array.from(this.subtrees.keys());
  }
}

export const AIBehaviorRegistry = new AIBehaviorRegistryImpl();
