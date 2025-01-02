# banira

The core library of the banira.js toolchain, providing essential utilities and runtime support for developing web components using vanilla JavaScript.

## Classes

### Compiler
The core TypeScript compilation engine that supports both standard and virtual filesystem operations. It provides:
- Flexible compilation with customizable compiler options
- Support for virtual filesystem compilation
- Built-in transformers for ES module compatibility
- Default configuration targeting modern browsers

### TestHelper
A powerful testing utility for web components that provides:
- JSDOM-based testing environment
- Component mounting and initialization
- Support for both pre-compiled and TypeScript components
- Customizable JSDOM options for specific testing needs

### ResultAnalyzer
Analyzes compilation results and provides detailed diagnostics:
- Error and warning categorization
- Formatted diagnostic messages
- Access to compiler output files
- Source file analysis capabilities

### VirtualCompilerHost
A TypeScript compiler host implementation using a virtual filesystem:
- In-memory file operations
- Isolation for testing and development
- Compatible with standard TypeScript compiler API
- Configurable working directory and file structure

## Usage

### Testing Components

```typescript
import { TestHelper } from 'banira';

const helper = new TestHelper();
const context = await helper.mountAsScript('my-component', componentCode);

// Access the mounted component
const component = context.querySelector('my-component');
```

### Virtual Filesystem

```typescript
import { createVirtualFs } from 'banira';

const fs = createVirtualFs({
  '/src/component.ts': `
    class MyComponent extends HTMLElement {
      // component code
    }
  `
});
```

## API Reference

For detailed API documentation, please refer to the generated API documentation in the project root.

## Dependencies

- jsdom: ^25.0.1
- memfs: ^4.15.1
- typescript: ^5.7.2

## Contributing

This package is part of the banira.js monorepo. Please refer to the main project's README for contribution guidelines.

## License

MIT © Sebastian Schürmann
