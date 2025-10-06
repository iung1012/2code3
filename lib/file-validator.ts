export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class FileValidator {
  validateFile(path: string, content: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validação de sintaxe baseada na extensão
    if (path.endsWith('.tsx') || path.endsWith('.ts')) {
      const tsErrors = this.validateTypeScript(content);
      errors.push(...tsErrors);
    }

    if (path.endsWith('.jsx') || path.endsWith('.js')) {
      const jsErrors = this.validateJavaScript(content);
      errors.push(...jsErrors);
    }

    if (path.endsWith('.json')) {
      const jsonErrors = this.validateJSON(content);
      errors.push(...jsonErrors);
    }

    // Validação de dependências
    if (path === 'package.json') {
      const depWarnings = this.validateDependencies(content);
      warnings.push(...depWarnings);
    }

    // Validação de imports
    const importWarnings = this.validateImports(content, path);
    warnings.push(...importWarnings);

    // Validação de tamanho
    if (content.length > 1024 * 1024) { // 1MB
      warnings.push(`File ${path} is very large (${Math.round(content.length / 1024)}KB)`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateTypeScript(content: string): string[] {
    const errors: string[] = [];

    // Verifica se tem export default para App.tsx
    if (content.includes('App') && !content.includes('export default')) {
      errors.push('App component should have a default export');
    }

    // Verifica imports do React
    if (content.includes('React') && !content.includes("import React")) {
      errors.push('Missing React import');
    }

    // Verifica sintaxe básica de JSX
    const openTags = (content.match(/<[^/][^>]*>/g) || []).length;
    const closeTags = (content.match(/<\/[^>]*>/g) || []).length;
    
    if (openTags !== closeTags) {
      errors.push('Mismatched JSX tags');
    }

    return errors;
  }

  private validateJavaScript(content: string): string[] {
    const errors: string[] = [];

    // Verifica se tem export default para App.jsx
    if (content.includes('App') && !content.includes('export default')) {
      errors.push('App component should have a default export');
    }

    // Verifica sintaxe básica
    try {
      // Tenta fazer parse básico removendo JSX
      const jsContent = content.replace(/<[^>]*>/g, '""');
      new Function(jsContent);
    } catch (e) {
      errors.push('Invalid JavaScript syntax');
    }

    return errors;
  }

  private validateJSON(content: string): string[] {
    const errors: string[] = [];

    try {
      JSON.parse(content);
    } catch (e) {
      errors.push(`Invalid JSON: ${e.message}`);
    }

    return errors;
  }

  private validateDependencies(content: string): string[] {
    const warnings: string[] = [];

    try {
      const pkg = JSON.parse(content);
      
      // Verifica dependências essenciais
      const requiredDeps = ['react', 'react-dom'];
      const missingDeps = requiredDeps.filter(dep => !pkg.dependencies?.[dep]);
      
      if (missingDeps.length > 0) {
        warnings.push(`Missing required dependencies: ${missingDeps.join(', ')}`);
      }

      // Verifica versões do React
      if (pkg.dependencies?.react && !pkg.dependencies.react.startsWith('^18')) {
        warnings.push('Consider using React 18 for better performance');
      }

    } catch (e) {
      warnings.push('Could not validate package.json');
    }

    return warnings;
  }

  private validateImports(content: string, filePath: string): string[] {
    const warnings: string[] = [];

    // Verifica imports relativos
    const relativeImports = content.match(/import.*from\s+['"]\.\.?\/[^'"]*['"]/g) || [];
    
    relativeImports.forEach(importStatement => {
      const importPath = importStatement.match(/['"]([^'"]*)['"]/)?.[1];
      if (importPath && !importPath.endsWith('.js') && !importPath.endsWith('.jsx') && !importPath.endsWith('.ts') && !importPath.endsWith('.tsx')) {
        warnings.push(`Consider adding file extension to import: ${importPath}`);
      }
    });

    // Verifica imports não utilizados (básico)
    const importStatements = content.match(/import\s+{([^}]+)}\s+from/g) || [];
    importStatements.forEach(statement => {
      const imports = statement.match(/{([^}]+)}/)?.[1].split(',').map(i => i.trim());
      if (imports) {
        imports.forEach(imp => {
          if (!content.includes(imp) || content.indexOf(imp) === content.indexOf(statement)) {
            warnings.push(`Potentially unused import: ${imp}`);
          }
        });
      }
    });

    return warnings;
  }

  // Validação em lote
  validateFiles(files: Record<string, string>): Record<string, ValidationResult> {
    const results: Record<string, ValidationResult> = {};
    
    for (const [path, content] of Object.entries(files)) {
      results[path] = this.validateFile(path, content);
    }
    
    return results;
  }
}

export const fileValidator = new FileValidator();
