import fs from "fs";
import path from "path";
import { promisify } from "util";

const SECRET_DIR = "/var/openfaas/secrets/";

async function getSecret(name: string) {
    if (process.env.JWT_SECRET) {
        return process.env.JWT_SECRET;
    } else {
        const filePath = path.resolve(SECRET_DIR, name);
        return await promisify(fs.readFile)(filePath, "utf8");
    }
}

export default getSecret;
