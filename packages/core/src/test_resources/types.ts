/**
 * Interface representing a User object.
 * 
 * @interface User
 * @property {string} id - The unique identifier of the User.
 * @property {string} [email] - The email address of the User (optional).
 * @property {string} [phone] - The phone number of the User (optional).
 * @property {string} [role] - The role of the User (optional).
 */
export interface User {
    id: string;
    email?: string;
    phone?: string;
    role?: string;
}
