import fetch from "isomorphic-fetch";
import { Readable } from "stream";
import signJwtToken from "./signJwtToken";

export const DEFAULT_FETCH_ASPECTS = [
    "dcat-dataset-strings",
    "dcat-distribution-strings",
    "dataset-distributions",
    "temporal-coverage",
    "usage",
    "access",
    "dataset-publisher",
    "source",
    "source-link-status",
    "dataset-quality-rating",
    "spatial-coverage",
    "publishing",
    "dataset-access-control",
    "organization-details",
    "provenance",
    "information-security",
    "currency",
    "ckan-export",
    "version"
];

export type Event = {
    eventTime: string;
    eventType: string;
    tenantId: number;
    userId: string;
    id: number;
    data: any;
};

async function getRecordHistory(
    registryUrl: string,
    recordId: string,
    options: {
        start: number;
        limit: number;
        pageToken: string;
        jwtToken?: string;
    }
) {
    const queryParameters: string[] = [
        "dereference=true",
        typeof options.start === "undefined" ? "" : `start=${options.start}`,
        typeof options.pageToken === "undefined"
            ? ""
            : `pageToken=${options.pageToken}`,
        typeof options.limit === "undefined" ? "" : `limit=${options.limit}`
    ]
        .filter(item => !!item)
        .concat(DEFAULT_FETCH_ASPECTS.map(aspect => "aspect=" + aspect));

    const tenantId = process.env.tenantId;
    const headers = {
        "X-Magda-Tenant-Id": tenantId ? tenantId : "0"
    } as any;

    if (options.jwtToken) {
        headers["X-Magda-Session"] = options.jwtToken;
    }

    const res = await fetch(
        `${registryUrl}/records/${encodeURIComponent(
            recordId
        )}/history?${queryParameters.join("&")}`,
        {
            headers
        }
    );

    if (!res.ok) {
        throw new Error(
            `Failed to fetch history from registry api. Error Code: ${
                res.status
            } Details: ${await res.text()}`
        );
    }

    return (await res.json()) as {
        hasMore: boolean;
        nextPageToken: string;
        events: Event[];
    };
}

const DEFAULT_LIMIT = 50;

export default class RegistryEventStream extends Readable {
    private hasMore: boolean;
    private pageToken: string;
    private limit: number;
    private registryApiUrl: string;
    private recordId: string;
    private userId: string | null;
    private dataCache: Event[];
    private isPushing: boolean;

    constructor(
        registryApiUrl: string,
        recordId: string,
        options: {
            userId: string | null;
            limit?: number;
        }
    ) {
        const limit = options.limit > 0 ? options.limit : DEFAULT_LIMIT;

        super({
            objectMode: true,
            highWaterMark: limit
        });

        this.limit = limit;

        if (!registryApiUrl) {
            throw new Error(
                "RegistryEventStream: Invalid empty registryApiUrl"
            );
        }

        if (!recordId) {
            throw new Error("RegistryEventStream: Invalid empty recordId");
        }

        this.registryApiUrl = registryApiUrl;
        this.recordId = recordId;
        this.userId = options.userId;
        this.dataCache = [];
        this.isPushing = false;
        this.hasMore = true;
    }

    async pushTillFull() {
        if (this.isPushing) {
            return;
        }

        try {
            this.isPushing = true;

            let pushMore = true;
            while (pushMore) {
                let event = this.dataCache.pop();
                if (!event) {
                    const result = await this.fetchMore();
                    if (!result) {
                        // error happen or no more to read
                        // send EOF
                        this.push(null);
                        return;
                    }
                    event = this.dataCache.pop();
                }
                if (!event) {
                    // still empty --- no more data & send EOF
                    this.push(null);
                    return;
                }
                pushMore = this.push(event);
            }
        } catch (e) {
            this.destroy(e as Error);
        } finally {
            this.isPushing = false;
        }
    }

    async fetchMore() {
        try {
            if (!this.hasMore) {
                return false;
            }

            const opts = {
                limit: this.limit
            } as any;

            if (this.pageToken) {
                opts.pageToken = this.pageToken;
            }

            if (this.userId) {
                opts.jwtToken = await signJwtToken(this.userId);
            }

            const data = await getRecordHistory(
                this.registryApiUrl,
                this.recordId,
                opts
            );

            this.hasMore = data?.hasMore ? true : false;
            this.pageToken = data?.nextPageToken ? data.nextPageToken : "";

            if (this.hasMore && !this.pageToken) {
                throw new Error(
                    "RegistryEventStream: Invalid reponse from history API: " +
                        JSON.stringify(data)
                );
            }

            if (data?.events?.length) {
                this.dataCache = this.dataCache.concat(data.events);
                return true;
            } else {
                return false;
            }
        } catch (e) {
            this.destroy(e as Error);
            return false;
        }
    }

    _read() {
        this.pushTillFull();
    }
}
