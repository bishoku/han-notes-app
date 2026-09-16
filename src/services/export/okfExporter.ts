import { storage } from '@/services/storage';
import { useGraphStore } from '@/store/graphStore';
import { useNoteStore } from '@/store/noteStore';

export interface OkfExportOptions {
  noteIds?: string[];
  includeGraph?: boolean;
  includeIndex?: boolean;
}

export interface OkfBundle {
  files: Map<string, string>;
}

class OkfBundleImpl implements OkfBundle {
  files: Map<string, string> = new Map();
}

export async function generateOkfBundle(options: OkfExportOptions = {}): Promise<OkfBundle> {
  const { noteIds, includeGraph = true, includeIndex = true } = options;
  const bundle = new OkfBundleImpl();

  const noteStoreState = useNoteStore.getState();
  const allNotes = noteStoreState.notes;
  
  const notesToExport = noteIds 
    ? allNotes.filter(n => noteIds.includes(n.id))
    : allNotes;

  let exportedNoteCount = 0;
  const indexNotes: Array<{ id: string; title: string; path: string; tags: string[] }> = [];

  for (const note of notesToExport) {
    try {
      const content = await storage.readNote(note.id);
      const notePath = `notes/${note.path || note.id + '.md'}`;
      
      bundle.files.set(notePath, content);
      exportedNoteCount++;

      if (includeIndex) {
        indexNotes.push({
          id: note.id,
          title: note.title,
          path: notePath,
          tags: note.tags || []
        });
      }
    } catch (e) {
      console.error(`Failed to export note: ${note.id}`, e);
    }
  }

  if (includeGraph) {
    const graphState = useGraphStore.getState();
    const graphData = {
      nodes: graphState.nodes.map(n => ({
        id: n.id,
        title: n.title,
        tags: n.tags,
        folder: n.folder
      })),
      edges: graphState.edges.map(e => ({
        source: e.source,
        target: e.target,
        type: e.type
      }))
    };
    bundle.files.set('graph.json', JSON.stringify(graphData, null, 2));
  }

  if (includeIndex) {
    const now = new Date().toISOString();
    let yaml = `bundle_name: "HAN Export"\n`;
    yaml += `exported_at: "${now}"\n`;
    yaml += `source: "HAN - Hierarchical Adaptive Notebook"\n`;
    yaml += `note_count: ${exportedNoteCount}\n`;
    yaml += `notes:\n`;
    
    for (const n of indexNotes) {
      yaml += `  - id: "${n.id}"\n`;
      yaml += `    title: "${n.title.replace(/"/g, '\\"')}"\n`;
      yaml += `    path: "${n.path}"\n`;
      yaml += `    tags: [${n.tags.map(t => `"${t}"`).join(', ')}]\n`;
    }
    
    bundle.files.set('index.yaml', yaml);
  }

  const readme = `# HAN Export Bundle\n\nThis bundle contains exported notes and metadata from HAN (Hierarchical Adaptive Notebook) in OKF (Open Knowledge Format) structure.\n\n- \`notes/\`: Contains your markdown notes preserving directory structure\n- \`graph.json\`: Contains your knowledge graph connections (if exported)\n- \`index.yaml\`: Contains manifest and metadata about the export (if exported)\n\nExported on: ${new Date().toLocaleString()}\n`;
  bundle.files.set('README.md', readme);

  return bundle;
}
