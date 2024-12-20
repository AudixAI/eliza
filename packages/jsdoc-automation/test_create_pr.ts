/**
 * Generate JSDoc comment for the following code:
 * 
 *         ```typescript
 *         function test_pr(x: number | string): number | string {
 *     if (typeof x === 'number') {
 *         return x * 2;
 *     }
 *     return x.toUpperCase();
 * }
 *         ```
 */
function test_pr(x: number | string): number | string {
    if (typeof x === 'number') {
        return x * 2;
    }
    return x.toUpperCase();
}