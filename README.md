# Vanillin.js

Vanillin.js is an open-source toolchain designed for the development of web components using vanilla JavaScript. It simplifies the process by eliminating the need for bundlers and frameworks, focusing instead on modern CSS and web standards.

## Features

* Low dependency footprint - bare bones tooling
* Learn web standards instead of frameworks
* TypeScript integration - develop TypeScript code and directly use it in integration tests
* Command-line interface for easy compilation and project management

## Installation

```bash
npm install -g @vanillin/cli
```

## Usage

### CLI Commands

```bash
# Show help and available commands
vanillin --help

# Compile TypeScript files
vanillin compile [options] <files...>

Options:
  -p, --project <path>  Path to tsconfig.json
  -o, --outDir <path>   Output directory
```

## Development

To set up the development environment:

```bash
# Install dependencies
make bootstrap

# Run tests
make test

# Clean build artifacts
make clean
```

## Project Structure

- `packages/vanillin`: Core library
- `packages/vanillin-cli`: Command-line interface
- `packages/component-my-circle`: Example component
