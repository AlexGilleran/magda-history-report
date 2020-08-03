import fs from "fs";
import path from "path";
import { promisify } from "util";

const SECRET_DIR = "/var/openfaas/secrets/";

const secretCache = {} as {
    [key: string]: string | Buffer;
};

/**
 * This function is used to retrieve secret value that set to function.
 * Assume you make secret `auth-secrets` available to the function and `auth-secrets` secret contains two keys `jwt-secret` & `session-secret`,
 * you should pass string `jwt-secret` as parameter `secretValueKey` to invoke the function
 *
 * @export
 * @param {string} secretValueKey
 * @param {boolean} [lookUpEnvVar=true]
 * @returns {Promise<string>}
 */
export default async function getSecret(
    secretValueKey: string,
    lookUpEnvVar: boolean = true
): Promise<string> {
    const envVar = secretValueKey
        .toUpperCase()
        .trim()
        .replace(/[-\s]/g, "_");

    if (lookUpEnvVar && typeof process?.env?.[envVar] !== "undefined") {
        return process.env[envVar] as string;
    } else {
        if (typeof secretCache[secretValueKey] === "undefined") {
            const filePath = path.resolve(SECRET_DIR, secretValueKey);
            secretCache[secretValueKey] = await promisify(fs.readFile)(
                filePath,
                "utf8"
            );
        }
        return secretCache[secretValueKey] as string;
    }
}
