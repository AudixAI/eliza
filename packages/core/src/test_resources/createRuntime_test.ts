import {
    SqliteDatabaseAdapter,
    loadVecExtensions,
} from "@ai16z/adapter-sqlite";
import { SqlJsDatabaseAdapter } from "@ai16z/adapter-sqljs";
import { SupabaseDatabaseAdapter } from "@ai16z/adapter-supabase";
import { DatabaseAdapter } from "../database.ts";
import { getEndpoint } from "../models.ts";
import { AgentRuntime } from "../runtime.ts";
import { Action, Evaluator, ModelProviderName, Provider } from "../types.ts";
import {
    SUPABASE_ANON_KEY,
    SUPABASE_URL,
    TEST_EMAIL,
    TEST_PASSWORD,
    zeroUuid,
} from "./constants.ts";
import { User } from "./types.ts";

/**
 * Asynchronously creates a runtime for the agent, based on the given configuration parameters.
 * 
 * @param {Object} options - The options object containing various runtime configuration parameters.
 * @param {Record<string, string> | NodeJS.ProcessEnv} [options.env] - The environment variables or Node.js process environment object.
 * @param {number} [options.conversationLength] - The desired length of the conversation.
 * @param {Evaluator[]} [options.evaluators] - Array of evaluators to be used in the runtime.
 * @param {Action[]} [options.actions] - Array of actions available in the runtime.
 * @param {Provider[]} [options.providers] - Array of providers for the runtime.
 * @returns {Object} An object containing the created user, session, and the instantiated runtime.
 */
 
async function createRuntime({
    env,
    conversationLength,
    evaluators = [],
    actions = [],
    providers = [],
}: {
    env?: Record<string, string> | NodeJS.ProcessEnv;
    conversationLength?: number;
    evaluators?: Evaluator[];
    actions?: Action[];
    providers?: Provider[];
}) {
    let adapter: DatabaseAdapter;
    let user: User;
    let session: {
        user: User;
    };

    switch (env?.TEST_DATABASE_CLIENT as string) {
        case "sqljs":
            {
                const module = await import("sql.js");

                const initSqlJs = module.default;

                // SQLite adapter
                const SQL = await initSqlJs({});
                const db = new SQL.Database();

                adapter = new SqlJsDatabaseAdapter(db);

                // Load sqlite-vss
                loadVecExtensions((adapter as SqlJsDatabaseAdapter).db);
                // Create a test user and session
                session = {
                    user: {
                        id: zeroUuid,
                        email: "test@example.com",
                    },
                };
            }
            break;
        case "supabase": {
            const module = await import("@supabase/supabase-js");

            const { createClient } = module;

            const supabase = createClient(
                env?.SUPABASE_URL ?? SUPABASE_URL,
                env?.SUPABASE_SERVICE_API_KEY ?? SUPABASE_ANON_KEY
            );

            const { data } = await supabase.auth.signInWithPassword({
                email: TEST_EMAIL!,
                password: TEST_PASSWORD!,
            });

            user = data.user as User;
            session = data.session as unknown as { user: User };

            if (!session) {
                const response = await supabase.auth.signUp({
                    email: TEST_EMAIL!,
                    password: TEST_PASSWORD!,
                });

                // Change the name of the user
                const { error } = await supabase
                    .from("accounts")
                    .update({ name: "Test User" })
                    .eq("id", response.data.user?.id);

                if (error) {
                    throw new Error(
                        "Create runtime error: " + JSON.stringify(error)
                    );
                }

                user = response.data.user as User;
                session = response.data.session as unknown as { user: User };
            }

            adapter = new SupabaseDatabaseAdapter(
                env?.SUPABASE_URL ?? SUPABASE_URL,
                env?.SUPABASE_SERVICE_API_KEY ?? SUPABASE_ANON_KEY
            );
            break;
        }
        case "sqlite":
        default:
            {
                const module = await import("better-sqlite3");

                const Database = module.default;

                // SQLite adapter
                adapter = new SqliteDatabaseAdapter(new Database(":memory:"));

                // Load sqlite-vss
                await loadVecExtensions((adapter as SqliteDatabaseAdapter).db);
                // Create a test user and session
                session = {
                    user: {
                        id: zeroUuid,
                        email: "test@example.com",
                    },
                };
            }
            break;
    }

    const runtime = new AgentRuntime({
        serverUrl: getEndpoint(ModelProviderName.OPENAI),
        conversationLength,
        token: env!.OPENAI_API_KEY!,
        modelProvider: ModelProviderName.OPENAI,
        actions: actions ?? [],
        evaluators: evaluators ?? [],
        providers: providers ?? [],
        databaseAdapter: adapter,
    });

    return { user, session, runtime };
}
