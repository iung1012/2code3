import { useCallback, useState } from 'react';
import { enhancedMessageParser, type ParsedContent } from '@/lib/enhanced-message-parser';
import { logger } from '@/lib/logger';

export function useEnhancedParser() {
  const [parsedResults, setParsedResults] = useState<ParsedContent[]>([]);

  const parseMessage = useCallback((messageId: string, content: string) => {
    logger.debug('Parsing message', { messageId, contentLength: content.length });
    
    const results = enhancedMessageParser.parse(messageId, content);
    setParsedResults(prev => [...prev, ...results]);
    
    logger.debug('Parsing complete', { resultsCount: results.length });
    return results;
  }, []);

  const resetParser = useCallback(() => {
    enhancedMessageParser.reset();
    setParsedResults([]);
    logger.debug('Parser reset');
  }, []);

  const getFiles = useCallback(() => {
    return parsedResults.filter(result => result.type === 'file');
  }, [parsedResults]);

  const getCommands = useCallback(() => {
    return parsedResults.filter(result => result.type === 'command');
  }, [parsedResults]);

  return {
    parsedResults,
    parseMessage,
    resetParser,
    getFiles,
    getCommands,
  };
}
