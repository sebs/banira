import { exclaim } from './punctuation.js';

export function greet(name: string): string {
    return exclaim('Hello, ' + name);
}
