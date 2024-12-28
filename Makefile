.PHONY: clean bootstrap test lint docs

# Clean all dependencies and build artifacts
clean:
	rm -rf packages/*/node_modules
	rm -rf packages/*/dist

# Install all dependencies
bootstrap:
	npm install -ws
	npm run build -ws

# Run all tests
test:
	npm test -ws

docs:
	npx typedoc --options ./packages/vanillin/typedoc.json --tsconfig ./packages/vanillin/tsconfig.json

lint:
	npx eslint "packages/**/*.ts"
