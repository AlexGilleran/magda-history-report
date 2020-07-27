import { promisify } from "util";
import jwt from "jsonwebtoken";
import { getSecretValue } from "./utils";

// JWT tokent expiry time
// we assume a single history request must arrive at registry api in 3s
const DEFAULT_EXPIRY = "3s";

// we always re-sign a new token as it might take long to go through all event pages
// the default JWT token 120ms would be too short for reuse the token
export default async function signJwtToken(userId: string) {
    const jwtSecret = await getSecretValue("auth-secrets", "jwt-secret");
    return await promisify<object, jwt.Secret, jwt.SignOptions, any>(jwt.sign)(
        {
            userId
        },
        jwtSecret,
        {
            expiresIn: DEFAULT_EXPIRY
        }
    );
}
