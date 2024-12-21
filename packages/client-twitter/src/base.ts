import {
    Content,
    IAgentRuntime,
    IImageDescriptionService,
    Memory,
    State,
    UUID,
    getEmbeddingZeroVector,
    elizaLogger,
    stringToUuid,
} from "@ai16z/eliza";
import {
    QueryTweetsResponse,
    Scraper,
    SearchMode,
    Tweet,
} from "agent-twitter-client";
import { EventEmitter } from "events";

/**
 * Extracts the answer from a given text.
 * 
 * @param {string} text - The text containing the answer. 
 * @returns {string} The extracted answer.
 */
export function extractAnswer(text: string): string {
    const startIndex = text.indexOf("Answer: ") + 8;
    const endIndex = text.indexOf("<|endoftext|>", 11);
    return text.slice(startIndex, endIndex);
}

/**
 * Defines the structure of a Twitter profile object.
 * @typedef {Object} TwitterProfile
 * @property {string} id - The unique identifier of the user.
 * @property {string} username - The username of the user.
 * @property {string} screenName - The screen name of the user.
 * @property {string} bio - The biography of the user.
 * @property {string[]} nicknames - The list of nicknames associated with the user.
 */
type TwitterProfile = {
    id: string;
    username: string;
    screenName: string;
    bio: string;
    nicknames: string[];
};

/**
 * Class representing a RequestQueue for handling asynchronous requests in a queue.
 */
 
class RequestQueue {
    private queue: (() => Promise<any>)[] = [];
    private processing: boolean = false;

/**
 * Asynchronously add a request to the queue and process it.
 * 
 * @template T
 * @param {() => Promise<T>} request - The function that returns a Promise representing the request to be added to the queue.
 * @returns {Promise<T>} - A Promise that resolves with the result of the request or rejects with an error.
 */
    async add<T>(request: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await request();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
            this.processQueue();
        });
    }

/**
 * Asynchronously processes items in the queue until all items are processed.
 * If an error occurs while processing an item, it will be added back to the queue
 * and a delay will be applied before attempting to process it again.
 * 
 * @returns A Promise that resolves once all items in the queue have been processed.
 */
    private async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0) {
            return;
        }
        this.processing = true;

        while (this.queue.length > 0) {
            const request = this.queue.shift()!;
            try {
                await request();
            } catch (error) {
                console.error("Error processing request:", error);
                this.queue.unshift(request);
                await this.exponentialBackoff(this.queue.length);
            }
            await this.randomDelay();
        }

        this.processing = false;
    }

/**
 * Implements exponential backoff strategy for retrying a failed operation.
 *
 * @param {number} retryCount - The number of times to retry the operation.
 * @returns {Promise<void>} - A Promise that resolves after the specified delay.
 */
    private async exponentialBackoff(retryCount: number): Promise<void> {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
    }

/**
 * Delays execution for a random amount of time between 1500ms and 3500ms.
 * @returns Promise that resolves after the random delay.
 */
    private async randomDelay(): Promise<void> {
        const delay = Math.floor(Math.random() * 2000) + 1500;
        await new Promise((resolve) => setTimeout(resolve, delay));
    }
}

/**
 * Class representing a base client for interacting with Twitter.
 * @extends EventEmitter
 */
export class ClientBase extends EventEmitter {
    static _twitterClients: { [accountIdentifier: string]: Scraper } = {};
    twitterClient: Scraper;
    runtime: IAgentRuntime;
    directions: string;
    lastCheckedTweetId: bigint | null = null;
    imageDescriptionService: IImageDescriptionService;
    temperature: number = 0.5;

    requestQueue: RequestQueue = new RequestQueue();

    profile: TwitterProfile | null;

/**
 * Caches the provided tweet in the cache manager.
 * @param {Tweet} tweet - The tweet to be cached.
 * @returns {Promise<void>} - A Promise that resolves when the tweet is cached.
 */
    async cacheTweet(tweet: Tweet): Promise<void> {
        if (!tweet) {
            console.warn("Tweet is undefined, skipping cache");
            return;
        }

        this.runtime.cacheManager.set(`twitter/tweets/${tweet.id}`, tweet);
    }

/**
  * Retrieves a cached Tweet object by its ID.
  * 
  * @param {string} tweetId - The ID of the tweet to retrieve from cache.
  * @returns {Promise<Tweet | undefined>} A Promise that resolves to the cached Tweet object, or undefined if not found.
  */
  **/
    async getCachedTweet(tweetId: string): Promise<Tweet | undefined> {
        const cached = await this.runtime.cacheManager.get<Tweet>(
            `twitter/tweets/${tweetId}`
        );

        return cached;
    }

/**
 * Retrieves a tweet by its ID. If the tweet is found in the cache, it is returned directly.
 * Otherwise, a request is made to the Twitter Client to fetch the tweet.
 * Once the tweet is retrieved, it is cached for future reference.
 * 
 * @param {string} tweetId - The ID of the tweet to retrieve.
 * @returns {Promise<Tweet>} A Promise that resolves with the retrieved tweet.
 */
    async getTweet(tweetId: string): Promise<Tweet> {
        const cachedTweet = await this.getCachedTweet(tweetId);

        if (cachedTweet) {
            return cachedTweet;
        }

        const tweet = await this.requestQueue.add(() =>
            this.twitterClient.getTweet(tweetId)
        );

        await this.cacheTweet(tweet);
        return tweet;
    }

    callback: (self: ClientBase) => any = null;

/**
 * Method called when the object is ready.
 * @throws {Error} Not implemented in base class, please call from subclass
 */
    onReady() {
        throw new Error(
            "Not implemented in base class, please call from subclass"
        );
    }

/**
 * Constructor for creating a new instance of ClientBase.
 * @param {IAgentRuntime} runtime - The runtime object for the agent.
 */
    constructor(runtime: IAgentRuntime) {
        super();
        this.runtime = runtime;
        const username = this.runtime.getSetting("TWITTER_USERNAME");
        if (ClientBase._twitterClients[username]) {
            this.twitterClient = ClientBase._twitterClients[username];
        } else {
            this.twitterClient = new Scraper();
            ClientBase._twitterClients[username] = this.twitterClient;
        }

        this.directions =
            "- " +
            this.runtime.character.style.all.join("\n- ") +
            "- " +
            this.runtime.character.style.post.join();
    }

/**
 * Asynchronously initializes the Twitter session.
 * Retrieves settings such as username, password, email, retry limit, 2FA secret, and cookies.
 * Checks for existing cookies and attempts to log in using the provided credentials.
 * Retries the login process if unsuccessful up to the specified limit.
 * Retrieves the user's Twitter profile information and stores it for later use.
 * Loads the latest checked tweet ID and populates the timeline.
 */
    async init() {
        //test
        const username = this.runtime.getSetting("TWITTER_USERNAME");
        const password = this.runtime.getSetting("TWITTER_PASSWORD");
        const email = this.runtime.getSetting("TWITTER_EMAIL");
        let retries = parseInt(
            this.runtime.getSetting("TWITTER_RETRY_LIMIT") || "5",
            10
        );
        const twitter2faSecret =
            this.runtime.getSetting("TWITTER_2FA_SECRET") || undefined;
        const cookies = this.runtime.getSetting("TWITTER_COOKIES");

        if (!username) {
            throw new Error("Twitter username not configured");
        }
        // Check for Twitter cookies
        if (cookies) {
            elizaLogger.debug("Using cookies from settings");
            const cookiesArray = JSON.parse(cookies);

            await this.setCookiesFromArray(cookiesArray);
        } else {
            elizaLogger.debug("No cookies found in settings");
            elizaLogger.debug("Checking for cached cookies");
            const cachedCookies = await this.getCachedCookies(username);
            if (cachedCookies) {
                await this.setCookiesFromArray(cachedCookies);
            }
        }

        elizaLogger.log("Waiting for Twitter login");
        while (retries > 0) {
            const cookies = await this.twitterClient.getCookies();
            if ((await this.twitterClient.isLoggedIn()) && !!cookies) {
                elizaLogger.info("Already logged in.");
                await this.cacheCookies(username, cookies);
                elizaLogger.info("Successfully logged in and cookies cached.");
                break;
            }

            try {
                await this.twitterClient.login(
                    username,
                    password,
                    email,
                    twitter2faSecret
                );
            } catch (error) {
                elizaLogger.error(`Login attempt failed: ${error.message}`);
            }

            retries--;
            elizaLogger.error(
                `Failed to login to Twitter. Retrying... (${retries} attempts left)`
            );

            if (retries === 0) {
                elizaLogger.error(
                    "Max retries reached. Exiting login process."
                );
                throw new Error("Twitter login failed after maximum retries.");
            }

            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        // Initialize Twitter profile
        this.profile = await this.fetchProfile(username);

        if (this.profile) {
            elizaLogger.log("Twitter user ID:", this.profile.id);
            elizaLogger.log(
                "Twitter loaded:",
                JSON.stringify(this.profile, null, 10)
            );
            // Store profile info for use in responses
            this.runtime.character.twitterProfile = {
                id: this.profile.id,
                username: this.profile.username,
                screenName: this.profile.screenName,
                bio: this.profile.bio,
                nicknames: this.profile.nicknames,
            };
        } else {
            throw new Error("Failed to load profile");
        }

        await this.loadLatestCheckedTweetId();
        await this.populateTimeline();
    }

/**
 * Asynchronously fetches a specified number of own posts.
 * 
 * @param {number} count - The number of posts to fetch.
 * @returns {Promise<Tweet[]>} A promise that resolves with an array of Tweets representing the fetched posts.
 */
    async fetchOwnPosts(count: number): Promise<Tweet[]> {
        elizaLogger.debug("fetching own posts");
        const homeTimeline = await this.twitterClient.getUserTweets(
            this.profile.id,
            count
        );
        return homeTimeline.tweets;
    }

/**
 * Fetches the home timeline with the specified count of tweets.
 *
 * @param {number} count - The number of tweets to fetch
 * @returns {Promise<Tweet[]>} - A promise that resolves with an array of processed tweets
 */
    async fetchHomeTimeline(count: number): Promise<Tweet[]> {
        elizaLogger.debug("fetching home timeline");
        const homeTimeline = await this.twitterClient.fetchHomeTimeline(
            count,
            []
        );

        elizaLogger.debug(homeTimeline, { depth: Infinity });
        const processedTimeline = homeTimeline
            .filter((t) => t.__typename !== "TweetWithVisibilityResults") // what's this about?
            .map((tweet) => {
                //console.log("tweet is", tweet);
                const obj = {
                    id: tweet.id,
                    name:
                        tweet.name ?? tweet?.user_results?.result?.legacy.name,
                    username:
                        tweet.username ??
                        tweet.core?.user_results?.result?.legacy.screen_name,
                    text: tweet.text ?? tweet.legacy?.full_text,
                    inReplyToStatusId:
                        tweet.inReplyToStatusId ??
                        tweet.legacy?.in_reply_to_status_id_str ??
                        null,
                    timestamp:
                        new Date(tweet.legacy?.created_at).getTime() / 1000,
                    createdAt:
                        tweet.createdAt ??
                        tweet.legacy?.created_at ??
                        tweet.core?.user_results?.result?.legacy.created_at,
                    userId: tweet.userId ?? tweet.legacy?.user_id_str,
                    conversationId:
                        tweet.conversationId ??
                        tweet.legacy?.conversation_id_str,
                    permanentUrl: `https://x.com/${tweet.core?.user_results?.result?.legacy?.screen_name}/status/${tweet.rest_id}`,
                    hashtags: tweet.hashtags ?? tweet.legacy?.entities.hashtags,
                    mentions:
                        tweet.mentions ?? tweet.legacy?.entities.user_mentions,
                    photos:
                        tweet.photos ??
                        tweet.legacy?.entities.media?.filter(
                            (media) => media.type === "photo"
                        ) ??
                        [],
                    thread: tweet.thread || [],
                    urls: tweet.urls ?? tweet.legacy?.entities.urls,
                    videos:
                        tweet.videos ??
                        tweet.legacy?.entities.media?.filter(
                            (media) => media.type === "video"
                        ) ??
                        [],
                };
                //console.log("obj is", obj);
                return obj;
            });
        //elizaLogger.debug("process homeTimeline", processedTimeline);
        return processedTimeline;
    }

/**
 * Fetches timeline for actions.
 * 
 * @param {number} count - The number of tweets to fetch.
 * @returns {Promise<Tweet[]>} - The array of tweets fetched along with their details.
 */
    async fetchTimelineForActions(count: number): Promise<Tweet[]> {
        elizaLogger.debug("fetching timeline for actions");
        const homeTimeline = await this.twitterClient.fetchHomeTimeline(
            count,
            []
        );

        return homeTimeline.map((tweet) => ({
            id: tweet.rest_id,
            name: tweet.core?.user_results?.result?.legacy?.name,
            username: tweet.core?.user_results?.result?.legacy?.screen_name,
            text: tweet.legacy?.full_text,
            inReplyToStatusId: tweet.legacy?.in_reply_to_status_id_str,
            timestamp: new Date(tweet.legacy?.created_at).getTime() / 1000,
            userId: tweet.legacy?.user_id_str,
            conversationId: tweet.legacy?.conversation_id_str,
            permanentUrl: `https://twitter.com/${tweet.core?.user_results?.result?.legacy?.screen_name}/status/${tweet.rest_id}`,
            hashtags: tweet.legacy?.entities?.hashtags || [],
            mentions: tweet.legacy?.entities?.user_mentions || [],
            photos:
                tweet.legacy?.entities?.media?.filter(
                    (media) => media.type === "photo"
                ) || [],
            thread: tweet.thread || [],
            urls: tweet.legacy?.entities?.urls || [],
            videos:
                tweet.legacy?.entities?.media?.filter(
                    (media) => media.type === "video"
                ) || [],
        }));
    }

/**
 * Fetch search tweets based on query, max number of tweets, search mode, and an optional cursor.
 * 
 * @param {string} query - The query to search for tweets.
 * @param {number} maxTweets - The maximum number of tweets to retrieve.
 * @param {SearchMode} searchMode - The search mode for fetching tweets.
 * @param {string} [cursor] - Optional cursor for fetching next set of tweets.
 * @returns {Promise<QueryTweetsResponse>} A promise that resolves to the response containing the query tweets.
 */
    async fetchSearchTweets(
        query: string,
        maxTweets: number,
        searchMode: SearchMode,
        cursor?: string
    ): Promise<QueryTweetsResponse> {
        try {
            // Sometimes this fails because we are rate limited. in this case, we just need to return an empty array
            // if we dont get a response in 5 seconds, something is wrong
            const timeoutPromise = new Promise((resolve) =>
                setTimeout(() => resolve({ tweets: [] }), 10000)
            );

            try {
                const result = await this.requestQueue.add(
                    async () =>
                        await Promise.race([
                            this.twitterClient.fetchSearchTweets(
                                query,
                                maxTweets,
                                searchMode,
                                cursor
                            ),
                            timeoutPromise,
                        ])
                );
                return (result ?? { tweets: [] }) as QueryTweetsResponse;
            } catch (error) {
                elizaLogger.error("Error fetching search tweets:", error);
                return { tweets: [] };
            }
        } catch (error) {
            elizaLogger.error("Error fetching search tweets:", error);
            return { tweets: [] };
        }
    }

/**
 * Populates the timeline with tweets from cache or fetches new tweets from the API.
 * 
 * @returns {Promise<void>} A promise that resolves once the timeline is populated.
 */
    private async populateTimeline() {
        elizaLogger.debug("populating timeline...");

        const cachedTimeline = await this.getCachedTimeline();

        // Check if the cache file exists
        if (cachedTimeline) {
            // Read the cached search results from the file

            // Get the existing memories from the database
            const existingMemories =
                await this.runtime.messageManager.getMemoriesByRoomIds({
                    roomIds: cachedTimeline.map((tweet) =>
                        stringToUuid(
                            tweet.conversationId + "-" + this.runtime.agentId
                        )
                    ),
                });

            //TODO: load tweets not in cache?

            // Create a Set to store the IDs of existing memories
            const existingMemoryIds = new Set(
                existingMemories.map((memory) => memory.id.toString())
            );

            // Check if any of the cached tweets exist in the existing memories
            const someCachedTweetsExist = cachedTimeline.some((tweet) =>
                existingMemoryIds.has(
                    stringToUuid(tweet.id + "-" + this.runtime.agentId)
                )
            );

            if (someCachedTweetsExist) {
                // Filter out the cached tweets that already exist in the database
                const tweetsToSave = cachedTimeline.filter(
                    (tweet) =>
                        !existingMemoryIds.has(
                            stringToUuid(tweet.id + "-" + this.runtime.agentId)
                        )
                );

                console.log({
                    processingTweets: tweetsToSave
                        .map((tweet) => tweet.id)
                        .join(","),
                });

                // Save the missing tweets as memories
                for (const tweet of tweetsToSave) {
                    elizaLogger.log("Saving Tweet", tweet.id);

                    const roomId = stringToUuid(
                        tweet.conversationId + "-" + this.runtime.agentId
                    );

                    const userId =
                        tweet.userId === this.profile.id
                            ? this.runtime.agentId
                            : stringToUuid(tweet.userId);

                    if (tweet.userId === this.profile.id) {
                        await this.runtime.ensureConnection(
                            this.runtime.agentId,
                            roomId,
                            this.profile.username,
                            this.profile.screenName,
                            "twitter"
                        );
                    } else {
                        await this.runtime.ensureConnection(
                            userId,
                            roomId,
                            tweet.username,
                            tweet.name,
                            "twitter"
                        );
                    }

                    const content = {
                        text: tweet.text,
                        url: tweet.permanentUrl,
                        source: "twitter",
                        inReplyTo: tweet.inReplyToStatusId
                            ? stringToUuid(
                                  tweet.inReplyToStatusId +
                                      "-" +
                                      this.runtime.agentId
                              )
                            : undefined,
                    } as Content;

                    elizaLogger.log("Creating memory for tweet", tweet.id);

                    // check if it already exists
                    const memory =
                        await this.runtime.messageManager.getMemoryById(
                            stringToUuid(tweet.id + "-" + this.runtime.agentId)
                        );

                    if (memory) {
                        elizaLogger.log(
                            "Memory already exists, skipping timeline population"
                        );
                        break;
                    }

                    await this.runtime.messageManager.createMemory({
                        id: stringToUuid(tweet.id + "-" + this.runtime.agentId),
                        userId,
                        content: content,
                        agentId: this.runtime.agentId,
                        roomId,
                        embedding: getEmbeddingZeroVector(),
                        createdAt: tweet.timestamp * 1000,
                    });

                    await this.cacheTweet(tweet);
                }

                elizaLogger.log(
                    `Populated ${tweetsToSave.length} missing tweets from the cache.`
                );
                return;
            }
        }

        const timeline = await this.fetchHomeTimeline(cachedTimeline ? 10 : 50);
        const username = this.runtime.getSetting("TWITTER_USERNAME");

        // Get the most recent 20 mentions and interactions
        const mentionsAndInteractions = await this.fetchSearchTweets(
            `@${username}`,
            20,
            SearchMode.Latest
        );

        // Combine the timeline tweets and mentions/interactions
        const allTweets = [...timeline, ...mentionsAndInteractions.tweets];

        // Create a Set to store unique tweet IDs
        const tweetIdsToCheck = new Set<string>();
        const roomIds = new Set<UUID>();

        // Add tweet IDs to the Set
        for (const tweet of allTweets) {
            tweetIdsToCheck.add(tweet.id);
            roomIds.add(
                stringToUuid(tweet.conversationId + "-" + this.runtime.agentId)
            );
        }

        // Check the existing memories in the database
        const existingMemories =
            await this.runtime.messageManager.getMemoriesByRoomIds({
                roomIds: Array.from(roomIds),
            });

        // Create a Set to store the existing memory IDs
        const existingMemoryIds = new Set<UUID>(
            existingMemories.map((memory) => memory.id)
        );

        // Filter out the tweets that already exist in the database
        const tweetsToSave = allTweets.filter(
            (tweet) =>
                !existingMemoryIds.has(
                    stringToUuid(tweet.id + "-" + this.runtime.agentId)
                )
        );

        elizaLogger.debug({
            processingTweets: tweetsToSave.map((tweet) => tweet.id).join(","),
        });

        await this.runtime.ensureUserExists(
            this.runtime.agentId,
            this.profile.username,
            this.runtime.character.name,
            "twitter"
        );

        // Save the new tweets as memories
        for (const tweet of tweetsToSave) {
            elizaLogger.log("Saving Tweet", tweet.id);

            const roomId = stringToUuid(
                tweet.conversationId + "-" + this.runtime.agentId
            );
            const userId =
                tweet.userId === this.profile.id
                    ? this.runtime.agentId
                    : stringToUuid(tweet.userId);

            if (tweet.userId === this.profile.id) {
                await this.runtime.ensureConnection(
                    this.runtime.agentId,
                    roomId,
                    this.profile.username,
                    this.profile.screenName,
                    "twitter"
                );
            } else {
                await this.runtime.ensureConnection(
                    userId,
                    roomId,
                    tweet.username,
                    tweet.name,
                    "twitter"
                );
            }

            const content = {
                text: tweet.text,
                url: tweet.permanentUrl,
                source: "twitter",
                inReplyTo: tweet.inReplyToStatusId
                    ? stringToUuid(tweet.inReplyToStatusId)
                    : undefined,
            } as Content;

            await this.runtime.messageManager.createMemory({
                id: stringToUuid(tweet.id + "-" + this.runtime.agentId),
                userId,
                content: content,
                agentId: this.runtime.agentId,
                roomId,
                embedding: getEmbeddingZeroVector(),
                createdAt: tweet.timestamp * 1000,
            });

            await this.cacheTweet(tweet);
        }

        // Cache
        await this.cacheTimeline(timeline);
        await this.cacheMentions(mentionsAndInteractions.tweets);
    }

/**
 * Asynchronously sets cookies from an array of objects containing cookie properties.
 * Each object in the array should have properties for key, value, domain, path, secure, httpOnly, and sameSite.
 * The cookies are then transformed into strings and passed to the twitterClient's setCookies method.
 *
 * @param {Array<Object>} cookiesArray - An array of objects representing the cookies to be set.
 * @returns {Promise<void>} A promise that resolves after the cookies are successfully set.
 */
    async setCookiesFromArray(cookiesArray: any[]) {
        const cookieStrings = cookiesArray.map(
            (cookie) =>
                `${cookie.key}=${cookie.value}; Domain=${cookie.domain}; Path=${cookie.path}; ${
                    cookie.secure ? "Secure" : ""
                }; ${cookie.httpOnly ? "HttpOnly" : ""}; SameSite=${
                    cookie.sameSite || "Lax"
                }`
        );
        await this.twitterClient.setCookies(cookieStrings);
    }

/**
 * Asynchronously saves a request message to memory if it has text content.
 * If the message already exists in memory, a debug message is logged. 
 * Otherwise, a new memory is created with zero vector embedding.
 * Finally, the message is evaluated with the current state and Twitter client.
 * 
 * @param {Memory} message - The message to be saved to memory.
 * @param {State} state - The current state of the application.
 * @returns {Promise<void>} A Promise that resolves once the message is saved and evaluated.
 */
    async saveRequestMessage(message: Memory, state: State) {
        if (message.content.text) {
            const recentMessage = await this.runtime.messageManager.getMemories(
                {
                    roomId: message.roomId,
                    count: 1,
                    unique: false,
                }
            );

            if (
                recentMessage.length > 0 &&
                recentMessage[0].content === message.content
            ) {
                elizaLogger.debug("Message already saved", recentMessage[0].id);
            } else {
                await this.runtime.messageManager.createMemory({
                    ...message,
                    embedding: getEmbeddingZeroVector(),
                });
            }

            await this.runtime.evaluate(message, {
                ...state,
                twitterClient: this.twitterClient,
            });
        }
    }

/**
 * Asynchronously loads the latest checked tweet ID from the cache and updates the value of 'lastCheckedTweetId' if a value is found.
 * 
 * @returns A Promise that resolves once the latest checked tweet ID is loaded and assigned to 'lastCheckedTweetId'.
 */
    async loadLatestCheckedTweetId(): Promise<void> {
        const latestCheckedTweetId =
            await this.runtime.cacheManager.get<string>(
                `twitter/${this.profile.username}/latest_checked_tweet_id`
            );

        if (latestCheckedTweetId) {
            this.lastCheckedTweetId = BigInt(latestCheckedTweetId);
        }
    }

/**
 * Asynchronously caches the latest checked tweet ID for the user's Twitter profile 
 */
    async cacheLatestCheckedTweetId() {
        if (this.lastCheckedTweetId) {
            await this.runtime.cacheManager.set(
                `twitter/${this.profile.username}/latest_checked_tweet_id`,
                this.lastCheckedTweetId.toString()
            );
        }
    }

/**
 * Retrieve cached timeline tweets for the current user profile.
 * @returns {Promise<Tweet[] | undefined>} A promise that resolves with an array of cached tweets or undefined if no cache exists.
 */
    async getCachedTimeline(): Promise<Tweet[] | undefined> {
        return await this.runtime.cacheManager.get<Tweet[]>(
            `twitter/${this.profile.username}/timeline`
        );
    }

/**
 * Caches the provided timeline data for the user profile in the cache storage.
 * @param {Tweet[]} timeline The timeline data to be cached.
 * @returns {Promise<void>} A promise that resolves once the data is cached.
 */
    async cacheTimeline(timeline: Tweet[]) {
        await this.runtime.cacheManager.set(
            `twitter/${this.profile.username}/timeline`,
            timeline,
            { expires: Date.now() + 10 * 1000 }
        );
    }

/**
 * Caches the provided array of mentions for the current Twitter profile.
 * 
 * @param {Tweet[]} mentions - An array of Tweet objects to be cached.
 * @returns {Promise<void>}
 */
    async cacheMentions(mentions: Tweet[]) {
        await this.runtime.cacheManager.set(
            `twitter/${this.profile.username}/mentions`,
            mentions,
            { expires: Date.now() + 10 * 1000 }
        );
    }

/**
 * Asynchronously retrieves cached cookies for a specified username from the cache manager.
 * @param {string} username - The username to retrieve cached cookies for.
 * @returns {Promise<any[]>} A promise that resolves to an array of cached cookies for the specified username.
 */
    async getCachedCookies(username: string) {
        return await this.runtime.cacheManager.get<any[]>(
            `twitter/${username}/cookies`
        );
    }

/**
 * Cache cookies for a specific user in Twitter.
 * 
 * @param {string} username - The username of the user whose cookies are being cached.
 * @param {any[]} cookies - The cookies to be cached.
 * @returns {Promise<void>} A Promise that resolves once the cookies are successfully cached.
 */
    async cacheCookies(username: string, cookies: any[]) {
        await this.runtime.cacheManager.set(
            `twitter/${username}/cookies`,
            cookies
        );
    }

/**
 * Retrieve the cached Twitter profile for a specific username.
 * 
 * @param {string} username - The username of the Twitter profile to retrieve.
 * @returns {Promise<TwitterProfile>} A Promise that resolves with the cached Twitter profile.
 */
    async getCachedProfile(username: string) {
        return await this.runtime.cacheManager.get<TwitterProfile>(
            `twitter/${username}/profile`
        );
    }

/**
 * Caches the Twitter profile of a user.
 * 
 * @param {TwitterProfile} profile - The Twitter profile to be cached.
 * @returns {Promise<void>} - A Promise that resolves once the profile is cached.
 */ 
         
    async cacheProfile(profile: TwitterProfile) {
        await this.runtime.cacheManager.set(
            `twitter/${profile.username}/profile`,
            profile
        );
    }

/**
 * Fetches the Twitter profile of a user.
 * 
 * @param {string} username - The username to fetch the profile for.
 * @returns {Promise<TwitterProfile>} A promise that resolves to the Twitter profile of the user.
 */
    async fetchProfile(username: string): Promise<TwitterProfile> {
        const cached = await this.getCachedProfile(username);

        if (cached) return cached;

        try {
            const profile = await this.requestQueue.add(async () => {
                const profile = await this.twitterClient.getProfile(username);
                // console.log({ profile });
                return {
                    id: profile.userId,
                    username,
                    screenName: profile.name || this.runtime.character.name,
                    bio:
                        profile.biography ||
                        typeof this.runtime.character.bio === "string"
                            ? (this.runtime.character.bio as string)
                            : this.runtime.character.bio.length > 0
                              ? this.runtime.character.bio[0]
                              : "",
                    nicknames:
                        this.runtime.character.twitterProfile?.nicknames || [],
                } satisfies TwitterProfile;
            });

            this.cacheProfile(profile);

            return profile;
        } catch (error) {
            console.error("Error fetching Twitter profile:", error);

            return undefined;
        }
    }
}
