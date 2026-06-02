.PHONY: clean bootstrap test lint docs

# Clean all dependencies and build artifacts
clean:
	rm -rf packages/*/node_modules
	rm -rf packages/*/dist

# Install all dependencies
bootstrap:
	npm install -ws
	npm run build -ws
	cd packages/banira-cli && npm install && npm run build && npm link && cd ../..

# Run all tests
test:
	npm test -ws

docs:
	npx typedoc --options ./packages/banira/typedoc.json --tsconfig ./packages/banira/tsconfig.json

# Type-check every package (incl. tests) with strict settings; emits nothing.
lint:
	npx tsc -p packages/banira/tsconfig.lint.json
	npx tsc -p packages/banira-cli/tsconfig.lint.json
	npx tsc -p packages/component-my-circle/tsconfig.lint.json
