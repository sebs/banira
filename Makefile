.PHONY: clean bootstrap test lint docs

# Locally installed dev tools, invoked directly instead of via npx.
BIN := ./node_modules/.bin

# Remove build artifacts and dependencies
clean:
	rm -rf dist docs node_modules

# Install dependencies and build
bootstrap:
	npm install
	npm run build

# Run the test suite
test:
	npm test

# Generate API documentation
docs:
	$(BIN)/typedoc

# Type-check src and tests with strict settings; emits nothing.
lint:
	$(BIN)/tsc -p tsconfig.lint.json
