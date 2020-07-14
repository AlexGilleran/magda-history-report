import express from "express";
import handler from "./index";

const app = express();

app.disable("x-powered-by");

(async () => {
    try {
        app.get("/healthz", (req: Express.Request, res: express.Response) => {
            res.status(200).send("OK");
        });
        app.use(await handler());

        const port = process.env.http_port || 3000;

        app.listen(port, () => {
            console.log(`OpenFaaS Node.js listening on port: ${port}`);
        });
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
