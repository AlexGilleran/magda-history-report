import stream from "stream";

declare module "dev-null" {
    export default function DevNull(
        opts: stream.WritableOptions
    ): stream.Writable;
}
