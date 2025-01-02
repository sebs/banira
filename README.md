# banira.js

> !!! WARNING: This is a work in progress. Please use at your own risk.

Rationale and background in a [blog post](https://dev.to/sebs/taking-llms-to-code-town-part-ii-creating-a-vanillajs-web-component-toolchain-from-ground-up-mi9)

banira.js is an open-source toolchain designed for the development of web components using vanilla JavaScript. It simplifies the process by eliminating the need for bundlers and frameworks, focusing instead on modern CSS and web standards.

| Package | Description |
|----|----|
| [banira](./packages/banira/README.md) | A toolchain for developing web components using vanilla JavaScript | 
| [banira-cli](./packages/banira-cli) | A CLI tool for banira |

## Getting Started

This software is a development build and work in progress. Your best shot will be to build it using a unix or linux machine. 

* make clean - remove all dependencies and build artifacts
* make bootstrap - install all dependencies
* make test - run all tests
* make lint - lint all TypeScript files
* make docs - generate the API documentation for banira

## Examples

* [my-circle](./packages/component-my-circle/README.md)
* [webaudio-controls](./packages/component-webaudio/README.md)