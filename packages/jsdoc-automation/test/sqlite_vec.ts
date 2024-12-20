function has_jsdoc(x: number | string): number | string {
    if (typeof x === 'number') {
        return x * 2;
    }
    return x.toUpperCase();
}


function does_not_have_jsdoc(x: number | string): number | string {
    if (typeof x === 'number') {
        return x * 2;
    }
    return x.toUpperCase();
}

function does_not_have_jsdoc_2(x: number | string): number | string {
    if (typeof x === 'number') {
        return x * 2;
    }
    return x.toUpperCase();
}

class SimpleClass {

    constructor(public x: number) { }

    simpleMethod(x: number): number {
        return x * 2;
    }

    simpleMethod2(x: number): string {
        return x.toString();
    }

    simpleMethod3(x: number): string {
        return x.toString();
    }
}

