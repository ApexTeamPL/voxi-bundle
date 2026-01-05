import { PluginInstanceInternal } from "@lib/addons/plugins/types";
import quickinstall from "./quickinstall";
import badges from "./badges";

interface CorePlugin {
    default: PluginInstanceInternal;
    preenabled: boolean;
}

// Called from @lib/plugins
export const getCorePlugins = (): Record<string, CorePlugin> => ({
    "bunny.quickinstall": {
        default: quickinstall,
        preenabled: true
    },
    "bunny.badges": {
        default: badges,
        preenabled: true
    }
});

/**
 * @internal
 */
export function defineCorePlugin(instance: PluginInstanceInternal): PluginInstanceInternal {
    // @ts-expect-error
    instance[Symbol.for("bunny.core.plugin")] = true;
    return instance;
}
