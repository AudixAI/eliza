/**
 * Interface for representing a user with the following properties:
 * @param {string} id - The unique identifier of the user.
 * @param {string} [email] - The email address of the user (optional).
 * @param {string} [phone] - The phone number of the user (optional).
 * @param {string} [role] - The role or position of the user (optional).
 */
```
export interface User {
    id: string;
    email?: string;
    phone?: string;
    role?: string;
}
