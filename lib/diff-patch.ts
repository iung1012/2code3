import { SEARCH_START, DIVIDER, REPLACE_END } from './diff-constants';

export interface DiffResult {
  modifiedContent: string;
  updatedLines: number[][];
  hasChanges: boolean;
}

/**
 * Aplica blocos de modificação SEARCH_START...DIVIDER...REPLACE_END
 * Baseado no sistema do DeepSite
 */
export const applyDiffPatches = (originalContent: string, diffContent: string): DiffResult => {
  let modifiedContent = originalContent;
  const updatedLines: number[][] = [];
  let position = 0;
  let moreBlocks = true;
  let hasChanges = false;

  while (moreBlocks) {
    const searchStartIndex = diffContent.indexOf(SEARCH_START, position);
    if (searchStartIndex === -1) {
      moreBlocks = false;
      continue;
    }

    const dividerIndex = diffContent.indexOf(DIVIDER, searchStartIndex);
    if (dividerIndex === -1) {
      moreBlocks = false;
      continue;
    }

    const replaceEndIndex = diffContent.indexOf(REPLACE_END, dividerIndex);
    if (replaceEndIndex === -1) {
      moreBlocks = false;
      continue;
    }

    const searchBlock = diffContent.substring(
      searchStartIndex + SEARCH_START.length,
      dividerIndex
    ).trim();
    
    const replaceBlock = diffContent.substring(
      dividerIndex + DIVIDER.length,
      replaceEndIndex
    ).trim();

    if (searchBlock === "") {
      // Inserção no início
      modifiedContent = `${replaceBlock}\n${modifiedContent}`;
      updatedLines.push([1, replaceBlock.split("\n").length]);
      hasChanges = true;
    } else {
      // Substituição de bloco existente
      const blockPosition = modifiedContent.indexOf(searchBlock);
      if (blockPosition !== -1) {
        const beforeText = modifiedContent.substring(0, blockPosition);
        const startLineNumber = beforeText.split("\n").length;
        const replaceLines = replaceBlock.split("\n").length;
        const endLineNumber = startLineNumber + replaceLines - 1;

        updatedLines.push([startLineNumber, endLineNumber]);
        modifiedContent = modifiedContent.replace(searchBlock, replaceBlock);
        hasChanges = true;
      }
    }

    position = replaceEndIndex + REPLACE_END.length;
  }

  return {
    modifiedContent,
    updatedLines,
    hasChanges
  };
};

/**
 * Detecta se o conteúdo contém blocos de diff/patch
 */
export const hasDiffBlocks = (content: string): boolean => {
  return content.includes(SEARCH_START) && 
         content.includes(DIVIDER) && 
         content.includes(REPLACE_END);
};

/**
 * Extrai apenas os blocos de diff/patch do conteúdo
 */
export const extractDiffBlocks = (content: string): string => {
  const lines = content.split('\n');
  const diffLines: string[] = [];
  let inDiffBlock = false;

  for (const line of lines) {
    if (line.includes(SEARCH_START)) {
      inDiffBlock = true;
      diffLines.push(line);
    } else if (line.includes(REPLACE_END)) {
      inDiffBlock = false;
      diffLines.push(line);
    } else if (inDiffBlock) {
      diffLines.push(line);
    }
  }

  return diffLines.join('\n');
};
