import fs from "fs";
import path from "path";
import { promisify } from "util";

const SECRET_DIR = "/var/openfaas/secrets/";
const secretCache = {} as {
    [key: string]: string | Buffer;
};

export async function getSecret<T extends string | Buffer = string>(
    name: string,
    readAsText: boolean = true
): Promise<T> {
    if (typeof secretCache[name] === "undefined") {
        const filePath = path.resolve(SECRET_DIR, name);
        if (readAsText) {
            secretCache[name] = await promisify(fs.readFile)(filePath, "utf8");
        } else {
            secretCache[name] = await promisify(fs.readFile)(filePath);
        }
    }
    return secretCache[name] as T;
}

const secretValueCache = {} as {
    [secretName: string]: {
        [valueKey: string]: any;
    };
};

export async function getSecretValue<T = string>(
    secretName: string,
    valueKey: string,
    lookUpEnvVar: boolean = true
): Promise<T> {
    const envVar = valueKey
        .toUpperCase()
        .trim()
        .replace(/[-\s]/g, "_");

    if (lookUpEnvVar && typeof process?.env?.[envVar] !== "undefined") {
        return (process.env[envVar] as unknown) as T;
    } else {
        if (typeof secretValueCache?.[secretName] === "undefined") {
            const secretContent = await getSecret(secretName);
            const data = JSON.parse(secretContent);
            if (!data) {
                throw new Error(
                    `Failed to read secret key ${valueKey} from secret: ${secretName}`
                );
            }
            secretValueCache[secretName] = data;
        }
        return secretValueCache[secretName]?.[valueKey];
    }
}
