/**
 * Reusable ESLint flat-config rule set enforcing UI System & Architecture boundaries:
 * 1. `no-raw-controls`: Blocks raw <button>/<input>/<select>/<textarea>/<table> outside design-system/.
 * 2. `no-adhoc-hex-or-inner-scroll`: Blocks inline hex colors & inner scroll boxes (max-h + overflow-y-auto).
 * 3. `no-duplicate-entity-views`: Blocks page-local Card/Row/Chip/Badge/Summary components (use entities/).
 * 4. `no-external-sdk-outside-acl`: Blocks direct 3rd-party vendor SDK imports outside acl/.
 * 5. `no-physical-css-directions`: Enforces logical RTL/LTR classes (ms/me/ps/pe/text-start/text-end).
 * 6. `no-child-outer-margin`: Enforces Parent-Owned Spacing (zero outer margin classes inside entities/).
 */

const FORBIDDEN_RAW_TAGS = new Set(["button", "input", "select", "textarea", "table"]);
const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/;
const ENTITY_VIEW_NAME_RE = /^[A-Z][a-zA-Z0-9]+(?:Card|Row|Chip|Badge|Pill|Avatar|Summary|ListItem)$/;
const PAGE_SCOPE_RE = /\/(?:pages|screens|views)\//;
const CANONICAL_SCOPE_RE = /\/(?:entities|design-system|primitives|shared)\//;
const EXTERNAL_SDK_RE = /^(?:stripe|twilio|openai|@anthropic-ai\/sdk|@sendgrid\/|firebase-admin|@aws-sdk\/|aws-sdk|resend|@supabase\/supabase-js)(?:\/|$)/;
const PHYSICAL_DIR_RE = /\b(?:ml|mr|pl|pr|text-left|text-right)-(?:[0-9]|px|auto)|\b(?:text-left|text-right)\b/;
const CHILD_OUTER_MARGIN_RE = /\b(?:m|mt|mb|ml|mr|ms|me|mx|my)-(?:[1-9]|0\.5)\b/;

export const uiSystemPlugin = {
  rules: {
    "no-raw-controls": {
      meta: { type: "problem", schema: [] },
      create(context) {
        const filename = context.filename.replace(/\\/g, "/");
        if (filename.includes("/design-system/") || filename.includes("/primitives/")) return {};
        return {
          JSXOpeningElement(node) {
            if (node.name?.type === "JSXIdentifier" && FORBIDDEN_RAW_TAGS.has(node.name.name)) {
              context.report({
                node,
                message: `Raw <${node.name.name}> is forbidden in screens; use the constrained primitive from design-system/.`,
              });
            }
          },
        };
      },
    },
    "no-adhoc-hex-or-inner-scroll": {
      meta: { type: "problem", schema: [] },
      create(context) {
        const filename = context.filename.replace(/\\/g, "/");
        if (filename.includes("/design-system/") || filename.includes("/tokens/")) return {};
        return {
          Literal(node) {
            if (typeof node.value !== "string") return;
            const v = node.value;
            if (HEX_COLOR_RE.test(v)) {
              context.report({ node, message: `Ad-hoc hex color "${v}" forbidden outside tokens; use semantic design tokens.` });
            }
            if (/\bmax-h-/.test(v) && /\boverflow-y-(?:auto|scroll)\b/.test(v)) {
              context.report({ node, message: "Inner scroll box (`max-h-*` + `overflow-y-auto`) is forbidden on pages." });
            }
          },
        };
      },
    },
    "no-duplicate-entity-views": {
      meta: { type: "problem", schema: [] },
      create(context) {
        const filename = context.filename.replace(/\\/g, "/");
        if (!PAGE_SCOPE_RE.test(filename) || CANONICAL_SCOPE_RE.test(filename)) return {};
        const checkName = (node, name) => {
          if (typeof name === "string" && ENTITY_VIEW_NAME_RE.test(name)) {
            context.report({
              node,
              message: `Page-local entity/value view "${name}" is forbidden; define ONE canonical density presenter in entities/ or design-system/ and reuse it across all screens.`,
            });
          }
        };
        return {
          FunctionDeclaration(node) {
            checkName(node, node.id?.name);
          },
          VariableDeclarator(node) {
            const initType = node.init?.type;
            if (initType === "ArrowFunctionExpression" || initType === "FunctionExpression") {
              checkName(node, node.id?.name);
            }
          },
        };
      },
    },
    "no-external-sdk-outside-acl": {
      meta: { type: "problem", schema: [] },
      create(context) {
        const filename = context.filename.replace(/\\/g, "/");
        if (filename.includes("/acl/") || /\.(?:test|spec)\./.test(filename)) return {};
        return {
          ImportDeclaration(node) {
            const src = node.source?.value;
            if (typeof src === "string" && EXTERNAL_SDK_RE.test(src)) {
              context.report({
                node,
                message: `External vendor SDK "${src}" is forbidden outside acl/; isolate third-party integrations behind an Anti-Corruption Layer.`,
              });
            }
          },
        };
      },
    },
    "no-physical-css-directions": {
      meta: { type: "problem", schema: [] },
      create(context) {
        const filename = context.filename.replace(/\\/g, "/");
        if (/\.(?:test|spec)\./.test(filename)) return {};
        return {
          Literal(node) {
            if (typeof node.value === "string" && PHYSICAL_DIR_RE.test(node.value)) {
              context.report({
                node,
                message: `Physical CSS direction in "${node.value}" breaks RTL/LTR; use logical classes (ms-/me-/ps-/pe-/text-start/text-end).`,
              });
            }
          },
        };
      },
    },
    "no-child-outer-margin": {
      meta: { type: "problem", schema: [] },
      create(context) {
        const filename = context.filename.replace(/\\/g, "/");
        if (!filename.includes("/entities/")) return {};
        return {
          Literal(node) {
            if (typeof node.value === "string" && CHILD_OUTER_MARGIN_RE.test(node.value)) {
              context.report({
                node,
                message: `Outer margin "${node.value}" inside entities/ violates Parent-Owned Spacing; let parent Stack/Inline/Grid own gap.`,
              });
            }
          },
        };
      },
    },
  },
};

export default uiSystemPlugin;
