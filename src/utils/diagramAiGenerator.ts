/**
 * diagramAiGenerator.ts
 * Utilities for generating, embedding, and synchronizing LLM-friendly textual summaries
 * of YADA architecture diagrams inside Markdown notes as hidden HTML comments.
 */

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generates an LLM-friendly textual breakdown of nodes, connections, protocols,
 * and sequence interaction flows from YADA logicalData and visualData.
 */
export function generateDiagramAiSummary(
  logicalData: any,
  visualData?: any,
  language: 'tr' | 'en' = 'tr'
): string {
  if (!logicalData) return '';

  const parsedLogical = typeof logicalData === 'string' ? JSON.parse(logicalData) : logicalData;
  const parsedVisual = typeof visualData === 'string' ? JSON.parse(visualData) : visualData;

  const nodes: any[] = Array.isArray(parsedLogical?.nodes) ? parsedLogical.nodes : [];
  const edges: any[] = Array.isArray(parsedLogical?.edges) ? parsedLogical.edges : [];
  const sequences: any[] = Array.isArray(parsedLogical?.sequences) ? parsedLogical.sequences : [];

  let text = `${language === 'tr'
    ? 'Aşağıdaki sistem mimarisini incele ve analiz et:'
    : 'Analyze and explain the following system architecture:'}\n\n`;

  text += `**${language === 'tr' ? 'Bileşenler' : 'Components'}:**\n`;
  if (nodes.length === 0) {
    text += language === 'tr' ? '- Tanımlı bileşen bulunmuyor.\n' : '- No components defined.\n';
  } else {
    nodes.forEach((node) => {
      const category = node.type || 'Generic';
      text += `- \`${node.name || node.id}\` (Type: ${category})\n`;
      if (node.properties && Object.keys(node.properties).length > 0) {
        text += `  - Metadata: ${JSON.stringify(node.properties)}\n`;
      }
    });
  }

  if (edges.length > 0) {
    text += `\n**${language === 'tr' ? 'Bağlantılar' : 'Connections'}:**\n`;
    edges.forEach((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.sourceId);
      const targetNode = nodes.find((n) => n.id === edge.targetId);
      const sourceName = sourceNode ? sourceNode.name : edge.sourceId;
      const targetName = targetNode ? targetNode.name : edge.targetId;

      text += `- \`${sourceName}\` → \`${targetName}\` (Protocol: ${edge.protocol || 'Call'})\n`;
      if (edge.description) {
        text += `  - Description: ${edge.description}\n`;
      }
      if (edge.properties && Object.keys(edge.properties).length > 0) {
        text += `  - Metadata: ${JSON.stringify(edge.properties)}\n`;
      }
    });
  }

  if (sequences.length > 0) {
    text += `\n**${language === 'tr' ? 'Etkileşim Akışı' : 'Interaction Flow'}:**\n`;

    const sortedSeqs = [...sequences].sort((a, b) => (a.stepNumber ?? 0) - (b.stepNumber ?? 0));

    sortedSeqs.forEach((seq) => {
      const edge = edges.find((e) => e.id === seq.edgeId);
      if (!edge) return;

      const sourceNode = nodes.find((n) => n.id === edge.sourceId);
      const targetNode = nodes.find((n) => n.id === edge.targetId);
      const sourceName = sourceNode ? sourceNode.name : edge.sourceId;
      const targetName = targetNode ? targetNode.name : edge.targetId;

      const syncType = seq.isAsync
        ? (language === 'tr' ? 'Asenkron' : 'Asynchronous')
        : (language === 'tr' ? 'Senkron' : 'Synchronous');
      const directionStr = `\`${sourceName}\` → \`${targetName}\`` + (seq.isRoundTrip ? ' ↔' : '');

      text += `${seq.stepNumber}. [${syncType}] ${directionStr} (Protocol: ${edge.protocol || 'Call'})\n`;

      if (edge.description) {
        text += `   - Description: ${edge.description}\n`;
      }

      const timing = parsedVisual?.timelines?.[seq.id];
      if (timing?.internalProcess?.text) {
        text += `   - Node \`${targetName}\` internal process: "${timing.internalProcess.text}"\n`;
      }
    });
  }

  return text.trimEnd();
}

/**
 * Wraps an AI summary inside an HTML comment block tagged for a specific diagram file.
 */
export function formatDiagramAiComment(fileNamePng: string, aiSummary: string): string {
  const cleanSummary = aiSummary.trim();
  return `<!-- diagram-ai:${fileNamePng}\n${cleanSummary}\n-->`;
}

/**
 * Updates or inserts the diagram-ai HTML comment block in markdown content.
 */
export function updateDiagramAiCommentInMarkdown(
  content: string,
  fileNamePng: string,
  newAiSummary: string
): string {
  const commentBlock = formatDiagramAiComment(fileNamePng, newAiSummary);
  const commentRegex = new RegExp(`<!--\\s*diagram-ai:${escapeRegex(fileNamePng)}[\\s\\S]*?-->`, 'g');

  if (commentRegex.test(content)) {
    return content.replace(commentRegex, commentBlock);
  }

  // If no existing comment block, look for the image line to append the comment right beneath it
  const imgRegex = new RegExp(`(!\\[[^\\]]*\\]\\([^)]*${escapeRegex(fileNamePng)}[^)]*\\))`, 'g');
  if (imgRegex.test(content)) {
    return content.replace(imgRegex, `$1\n${commentBlock}`);
  }

  // Fallback: append to end of content
  return `${content.trimEnd()}\n\n${commentBlock}\n`;
}

/**
 * Removes the diagram-ai comment associated with a diagram file if present.
 */
export function removeDiagramAiCommentFromMarkdown(
  content: string,
  fileNamePng: string
): string {
  const commentRegex = new RegExp(`\\n*<!--\\s*diagram-ai:${escapeRegex(fileNamePng)}[\\s\\S]*?-->`, 'g');
  return content.replace(commentRegex, '');
}
