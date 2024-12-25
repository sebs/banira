export class TestClass {
    greeting: string;

    constructor(greeting: string = "Hello") {
        this.greeting = greeting;
    }

    sayHello(): string {
        return `${this.greeting}, World!`;
    }
}
