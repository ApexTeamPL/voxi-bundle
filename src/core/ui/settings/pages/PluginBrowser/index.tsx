import { React, NavigationNative } from "@metro/common";
import { View } from "react-native";
import { Stack, Button, IconButton, Text, Card, FlashList, TableRowGroup, TableSwitchRow, TextInput } from "@metro/common/components";
import { findAssetId } from "@lib/api/assets";
import safeFetch from "@lib/utils/safeFetch";
import { showToast } from "@ui/toasts";
import Search from "@ui/components/Search";
import { VdPluginManager } from "@core/vendetta/plugins";
import { installTheme, themes, removeTheme } from "@lib/addons/themes";
import { clipboard } from "@metro/common";
import { hideSheet, showSheet } from "@lib/ui/sheets";
import { AlertActionButton } from "@lib/ui/components/wrappers";
import { dismissAlert, openAlert } from "@lib/ui/alerts";
import { ActionSheet, AlertModal, AlertActions, TableRow } from "@metro/common/components";
import { lazyDestructure } from "@lib/utils/lazy";
import { findByProps } from "@metro";

const { showSimpleActionSheet } = lazyDestructure(() => findByProps("showSimpleActionSheet"));
const { hideActionSheet } = findByProps("hideActionSheet")

interface BaseAddonData {
    name: string;
    description: string;
    authors: string[];
    installUrl: string;
    source?: string;
}

interface PluginData extends BaseAddonData {
    status: "working" | "broken" | "warning" | string;
    sourceUrl: string;
    warningMessage?: string;
}

interface ThemeData extends BaseAddonData {}

type AddonData = PluginData | ThemeData;

// Simple repository interface
interface Repository {
    id: string;
    name: string;
    url: string;
    enabled: boolean;
}

// Default repositories
const DEFAULT_REPOSITORIES: Repository[] = [
    {
        id: "official",
        name: "Official Plugins",
        url: "https://raw.githubusercontent.com/ApexTeamPL/Plugins-List/refs/heads/main/offical-plugins.json",
        enabled: true
    },
    {
        id: "user",
        name: "User Plugins",
        url: "https://raw.githubusercontent.com/ApexTeamPL/Plugins-List/refs/heads/main/user-plugins.json",
        enabled: true
    },
    {
        id: "bunny",
        name: "Arthur's Repository",
        url: "https://raw.githubusercontent.com/Purple-EyeZ/Plugins-List/refs/heads/main/src/plugins-data.json",
        enabled: true
    }
];

const THEME_URL = "https://raw.githubusercontent.com/kmmiio99o/theme-marketplace/refs/heads/main/themes.json";

// Storage keys
const REPOSITORIES_STORAGE_KEY = "plugin-browser-repositories";

// Helper functions for storage
function getStoredRepositories(): Repository[] {
    try {
        const stored = localStorage.getItem(REPOSITORIES_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error("Failed to load repositories:", e);
    }
    return DEFAULT_REPOSITORIES;
}

function saveRepositories(repositories: Repository[]) {
    try {
        localStorage.setItem(REPOSITORIES_STORAGE_KEY, JSON.stringify(repositories));
    } catch (e) {
        console.error("Failed to save repositories:", e);
    }
}

function normalizeIdFromInstallUrl(url: string) {
    return url.endsWith("/") ? url : url + "/";
}

// @ts-ignore
function InstallButton({ addon, isPluginMode, installing, setInstalling, setRefreshTick }) {
    const normId = normalizeIdFromInstallUrl(addon.installUrl);
    const [installed, setInstalled] = React.useState(() =>
        isPluginMode ? Boolean(VdPluginManager.plugins[normId]) : Boolean(themes[addon.installUrl])
    );

    React.useEffect(() => {
        setInstalled(isPluginMode ? Boolean(VdPluginManager.plugins[normId]) : Boolean(themes[addon.installUrl]));
    }, [addon.installUrl, setRefreshTick, isPluginMode]);

    const installAddon = async () => {
        if (installing.has(normId)) return;
        setInstalling((prev: Iterable<unknown> | null | undefined) => new Set(prev).add(normId));
        try {
            if (isPluginMode) {
                await VdPluginManager.installPlugin(normId, true);
            } else {
                await installTheme(addon.installUrl);
            }
            showToast(`Installed ${addon.name}`, findAssetId("CheckIcon"));
            setInstalled(true);
        } catch (e) {
            showToast(e instanceof Error ? e.message : String(e), findAssetId("CircleXIcon-primary"));
        } finally {
            setInstalling((prev: Iterable<unknown> | null | undefined) => { const s = new Set(prev); s.delete(normId); return s; });
            setRefreshTick((t: number) => t + 1);
        }
    };

    const uninstallAddon = async () => {
        try {
            if (isPluginMode) {
                await VdPluginManager.removePlugin(normId);
            } else {
                await removeTheme(addon.installUrl);
            }
            showToast(`Uninstalled ${addon.name}`, findAssetId("TrashIcon"));
            setInstalled(false);
        } catch (e) {
            showToast(e instanceof Error ? e.message : String(e), findAssetId("CircleXIcon-primary"));
        } finally {
            setRefreshTick((t: number) => t + 1);
        }
    };

    const promptInstall = () => {
        if (!isPluginMode) return installAddon();

        const plugin = addon as PluginData;
        const needsWarn = (plugin.status && plugin.status !== "working") || (plugin.warningMessage && plugin.warningMessage.trim().length > 0);
        if (!needsWarn) return installAddon();

        const lines: string[] = [];
        if (plugin.status && plugin.status !== "working") {
            if (plugin.status === "broken") lines.push("This plugin is marked as broken, please be aware you may encounter issues");
            else if (plugin.status === "warning") lines.push("This plugin may have issues");
            else lines.push(`Status: ${plugin.status}`);
        }
        if (plugin.warningMessage) lines.push(plugin.warningMessage);

        openAlert("plugins-list-install-warning", (
            <AlertModal
                title="Warning!"
                content="This plugin may not work as expected."
                extraContent={<Text variant="text-sm/normal" color="text-muted">{lines.join("\n\n")}</Text>}
                actions={<AlertActions>
                    <AlertActionButton
                        text="Install Anyway"
                        variant="primary"
                        onPress={() => { dismissAlert("plugins-list-install-warning"); installAddon(); }}
                    />
                    <AlertActionButton
                        text="Cancel"
                        variant="secondary"
                        onPress={() => dismissAlert("plugins-list-install-warning")}
                    />
                </AlertActions>}
            />
        ));
    };

    return (
        <Button
            size="sm"
            loading={installing.has(normId)}
            text={!installed ? (installing.has(normId) ? "Installing..." : "Install") : "Uninstall"}
            disabled={installing.has(normId)}
            onPress={!installed ? promptInstall : uninstallAddon}
            variant={!installed ? "primary" : "destructive"}
            icon={findAssetId(!installed ? "DownloadIcon" : "TrashIcon")}
        />
    );
}

// @ts-ignore
function TrailingButtons({ addon, isPluginMode, installing, setInstalling, setRefreshTick }) {
    const copyAddonLink = () => {
        clipboard.setString(addon.installUrl);
        // @ts-ignore
        showToast.showCopyToClipboard?.();
    };

    const copySourceUrl = () => {
        const plugin = addon as PluginData;
        clipboard.setString(plugin.sourceUrl);
        // @ts-ignore
        showToast.showCopyToClipboard?.();
    };

    const openAddonMenu = () => {
        const actions = [
            {
                label: `Copy ${isPluginMode ? 'Plugin' : 'Theme'} Link`,
                icon: findAssetId("CopyIcon"),
                onPress: copyAddonLink
            }
        ];

        if (isPluginMode && (addon as PluginData).sourceUrl) {
            actions.push({
                label: "Copy Source URL",
                icon: findAssetId("CopyIcon"),
                onPress: copySourceUrl
            });
        }

        const sheetKey = `${isPluginMode ? 'plugin' : 'theme'}-menu`;
        showSheet(sheetKey, () => (
            <ActionSheet>
                <TableRowGroup title={`${isPluginMode ? 'Plugin' : 'Theme'} Info`}>
                    {actions.map((action, index) => (
                        <TableRow
                            key={index}
                            label={action.label}
                            icon={<TableRow.Icon source={action.icon} />}
                            onPress={() => {
                                action.onPress();
                                hideSheet(sheetKey);
                            }}
                        />
                    ))}
                </TableRowGroup>
            </ActionSheet>
        ));
    };

    return (
        <Stack spacing={8} direction="horizontal">
            <IconButton
                size="sm"
                onPress={openAddonMenu}
                variant="secondary"
                icon={findAssetId("MoreHorizontalIcon")}
            />
            <InstallButton
                addon={addon}
                isPluginMode={isPluginMode}
                installing={installing}
                setInstalling={setInstalling}
                setRefreshTick={setRefreshTick}
            />
        </Stack>
    );
}

// @ts-ignore
function AddonCard({ addon, isPluginMode, installing, setInstalling, setRefreshTick }) {
    const { name, description, authors, source } = addon;
    const plugin = addon as PluginData;

    let statusColor = "text-normal";
    if (isPluginMode) {
        if (plugin.status === "working") statusColor = "#4ADE80";
        if (plugin.status === "broken") statusColor = "#EF4444";
        if (plugin.status === "warning") statusColor = "#F59E0B";
    }

    return (
        <Card>
            <Stack spacing={16}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flexShrink: 1 }}>
                        <Text numberOfLines={1} variant="heading-lg/semibold">
                            {name}
                        </Text>
                        <Text variant="text-md/semibold" color="text-muted">
                            by {authors?.join(", ") || "Unknown"}
                        </Text>
                        {isPluginMode && (
                            <>
                                <Text variant="text-md/semibold" style={{ color: statusColor }}>
                                    Status: {plugin.status}
                                </Text>
                                {source && (
                                    <Text variant="text-xs/medium" color="text-muted">
                                        Source: {source}
                                    </Text>
                                )}
                            </>
                        )}
                    </View>
                    <View>
                        <TrailingButtons
                            addon={addon}
                            isPluginMode={isPluginMode}
                            installing={installing}
                            setInstalling={setInstalling}
                            setRefreshTick={setRefreshTick}
                        />
                    </View>
                </View>
                <Text variant="text-md/medium">
                    {description}
                </Text>
                {isPluginMode && plugin.warningMessage && (
                    <Text variant="text-sm/medium" color="text-muted">
                        Warning: {plugin.warningMessage}
                    </Text>
                )}
            </Stack>
        </Card>
    );
}

enum Sort {
    DateNewest = "Newest",
    DateOldest = "Oldest",
    NameAZ = "Name (A–Z)",
    NameZA = "Name (Z–A)",
    WorkingFirst = "Working First",
    BrokenFirst = "Broken First",
}

export default function BrowserPage() {
    const navigation = NavigationNative.useNavigation();

    const [mode, setMode] = React.useState<"plugins" | "themes">("plugins");
    const [plugins, setPlugins] = React.useState<PluginData[]>([]);
    const [themesList, setThemesList] = React.useState<ThemeData[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [installing, setInstalling] = React.useState<Set<string>>(new Set());
    const [setRefreshTick] = React.useState(0);
    const [sort, setSort] = React.useState<Sort>(Sort.DateNewest);

    // Repository state
    const [repositories, setRepositories] = React.useState<Repository[]>(getStoredRepositories());
    const [newRepoName, setNewRepoName] = React.useState("");
    const [newRepoUrl, setNewRepoUrl] = React.useState("");

    // Set header button
    React.useEffect(() => {
        navigation.setOptions({
            title: "Browser",
            headerRight: () => mode === "plugins" ? (
                <Button
                    size="sm"
                    text="Sources"
                    variant="secondary"
                    onPress={openSourcesMenu}
                    icon={findAssetId("ServerIcon")}
                    iconPosition="start"
                    style={{ marginRight: 10 }}
                />
            ) : null
        });
    }, [navigation, mode]);

    React.useEffect(() => {
        saveRepositories(repositories);
    }, [repositories]);

    // Fetch plugins from enabled repositories
    const fetchPluginsData = React.useCallback(async () => {
        const enabledRepos = repositories.filter(repo => repo.enabled);

        if (enabledRepos.length === 0) {
            setPlugins([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const promises = enabledRepos.map(async (repo) => {
                try {
                    const response = await safeFetch(repo.url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    const data = await response.json();

                    let pluginsFromRepo: PluginData[] = [];
                    if (Array.isArray(data)) {
                        pluginsFromRepo = data;
                    } else if (data.OFFICIAL_PLUGINS) {
                        pluginsFromRepo = data.OFFICIAL_PLUGINS;
                    } else {
                        pluginsFromRepo = data.plugins || data.PLUGINS || data.items || [];
                    }

                    // Add source information to each plugin
                    return pluginsFromRepo.map(plugin => ({
                        ...plugin,
                        source: repo.name
                    }));
                } catch (e) {
                    console.warn(`Failed to fetch from ${repo.name}:`, e);
                    return [];
                }
            });

            const results = await Promise.all(promises);
            const allPlugins = results.flat();

            // Remove duplicates based on installUrl
            const uniquePluginsMap = new Map<string, PluginData>();
            allPlugins.forEach(plugin => {
                const normalizedUrl = normalizeIdFromInstallUrl(plugin.installUrl);
                if (!uniquePluginsMap.has(normalizedUrl)) {
                    uniquePluginsMap.set(normalizedUrl, plugin);
                }
            });

            setPlugins(Array.from(uniquePluginsMap.values()));
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            setPlugins([]);
        } finally {
            setLoading(false);
        }
    }, [repositories]);

    // Fetch themes (only one source)
    const fetchThemesData = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await safeFetch(THEME_URL);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            const data = await response.json();

            let addonList: ThemeData[] = [];
            if (Array.isArray(data)) {
                addonList = data;
            } else {
                addonList = data.OFFICIAL_THEMES || data.themes || data.THEMES || data.items || [];
            }

            setThemesList(addonList);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            setThemesList([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Toggle repository enabled state
    const toggleRepository = (repoId: string) => {
        setRepositories(prev => prev.map(repo =>
            repo.id === repoId ? { ...repo, enabled: !repo.enabled } : repo
        ));
    };

    const addNewRepository = () => {
        if (!newRepoName.trim() || !newRepoUrl.trim()) {
            showToast("Please enter both name and URL", findAssetId("CircleXIcon-primary"));
            return;
        }

        const url = newRepoUrl.trim();

        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            showToast("URL must start with http:// or https://", findAssetId("CircleXIcon-primary"));
            return;
        }

        // Check if it's a valid URL format
        try {
            new URL(url);
        } catch {
            showToast("Invalid URL format", findAssetId("CircleXIcon-primary"));
            return;
        }

        // Check if URL ends with .json
        if (!url.toLowerCase().endsWith('.json')) {
            showToast("URL must point to a .json file", findAssetId("CircleXIcon-primary"));
            return;
        }

        // Check for duplicate URLs
        if (repositories.some(repo => repo.url === url)) {
            showToast("This source already exists", findAssetId("CircleXIcon-primary"));
            return;
        }

        const newRepo: Repository = {
            id: `custom-${Date.now()}`,
            name: newRepoName.trim(),
            url: url,
            enabled: true
        };

        setRepositories(prev => [...prev, newRepo]);
        setNewRepoName("");
        setNewRepoUrl("");
        showToast("Repository added", findAssetId("CheckIcon"));
    };

    // Remove repository
    const removeRepository = (repoId: string) => {
        setRepositories(prev => prev.filter(repo => repo.id !== repoId));
        showToast("Repository removed", findAssetId("TrashIcon"));
    };

    const openAddSourceMenu = () => {
        const addSheetKey = "add-source-menu";

        showSheet(addSheetKey, () => (
            <ActionSheet>
                <TableRowGroup title="Add Custom Source">
                    <View style={{ paddingHorizontal: 16, paddingVertical: 16, gap: 12 }}>
                        <TextInput
                            placeholder="Source Name"
                            value={newRepoName}
                            onChange={setNewRepoName}
                        />
                        <TextInput
                            placeholder="Source URL"
                            value={newRepoUrl}
                            onChange={setNewRepoUrl}
                        />
                        <Button
                            size="md"
                            text="Add Source"
                            onPress={() => {
                                addNewRepository();
                                hideSheet(addSheetKey);
                            }}
                            icon={findAssetId("PlusIcon")}
                            iconPosition="start"
                        />
                    </View>
                </TableRowGroup>
            </ActionSheet>
        ));
    };

    const openSourcesMenu = () => {
        const sheetKey = "sources-menu";

        showSheet(sheetKey, () => (
            <ActionSheet>
                <TableRowGroup title="Plugin Sources">
                    {repositories.map((repo) => {
                        const isDefault = DEFAULT_REPOSITORIES.some(r => r.id === repo.id);

                        return (
                            <TableRow
                                key={repo.id}
                                label={repo.name}
                                subLabel={repo.url}
                                icon={<TableRow.Icon source={findAssetId("ServerIcon")} />}
                                trailing={
                                    <IconButton
                                        size="sm"
                                        variant="destructive"
                                        icon={findAssetId("TrashIcon")}
                                        disabled={isDefault}
                                        onPress={() => {
                                            openAlert("remove-repo-confirm", (
                                                <AlertModal
                                                    title="Remove Source"
                                                    content={`Are you sure you want to remove "${repo.name}"?`}
                                                    actions={
                                                        <AlertActions>
                                                            <AlertActionButton
                                                                text="Remove"
                                                                variant="destructive"
                                                                onPress={() => {
                                                                    removeRepository(repo.id);
                                                                    dismissAlert("remove-repo-confirm");
                                                                }}
                                                            />
                                                            <AlertActionButton
                                                                text="Cancel"
                                                                variant="secondary"
                                                                onPress={() => dismissAlert("remove-repo-confirm")}
                                                            />
                                                        </AlertActions>
                                                    }
                                                />
                                            ));
                                        }}
                                    />
                                }
                            />
                        );
                    })}
                </TableRowGroup>

                <TableRowGroup>
                    <TableRow
                        label="Add Custom Source"
                        icon={<TableRow.Icon source={findAssetId("PlusIcon")} />}
                        onPress={() => {
                            hideSheet(sheetKey);
                            setTimeout(() => openAddSourceMenu(), 300);
                        }}
                    />
                </TableRowGroup>
            </ActionSheet>
        ));
    };

    // Fetch data when repositories change or on mount
    React.useEffect(() => {
        if (mode === "plugins") {
            fetchPluginsData();
        } else {
            fetchThemesData();
        }
    }, [mode, repositories, fetchPluginsData, fetchThemesData]);

    const filterList = (list: AddonData[]) => {
        if (!list) return [] as AddonData[];
        const q = searchQuery.toLowerCase();
        if (!q) return list;
        return list.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            (p.authors || []).some(a => a.toLowerCase().includes(q))
        );
    };

    const sortedAndFiltered = React.useMemo(() => {
        const list = filterList(mode === "plugins" ? plugins : themesList);

        const getStatusPriority = (status: PluginData["status"], sortBy: Sort): number => {
            if (sortBy === Sort.WorkingFirst) {
                return status === "working" || status === "warning" ? 0 : 1;
            }
            if (sortBy === Sort.BrokenFirst) {
                return status === "broken" ? 0 : 1;
            }
            return 0;
        };

        switch (sort) {
            case Sort.DateNewest:
                return [...list].reverse();
            case Sort.DateOldest:
                return [...list];
            case Sort.NameAZ:
                return [...list].sort((a, b) => a.name.localeCompare(b.name));
            case Sort.NameZA:
                return [...list].sort((a, b) => b.name.localeCompare(a.name));
            case Sort.WorkingFirst:
                if (mode === "plugins") {
                    return [...list].sort((a, b) => {
                        const pa = getStatusPriority((a as PluginData).status, Sort.WorkingFirst);
                        const pb = getStatusPriority((b as PluginData).status, Sort.WorkingFirst);
                        return pa !== pb ? pa - pb : a.name.localeCompare(b.name);
                    });
                }
                return list;
            case Sort.BrokenFirst:
                if (mode === "plugins") {
                    return [...list].sort((a, b) => {
                        const pa = getStatusPriority((a as PluginData).status, Sort.BrokenFirst);
                        const pb = getStatusPriority((b as PluginData).status, Sort.BrokenFirst);
                        return pa !== pb ? pa - pb : a.name.localeCompare(b.name);
                    });
                }
                return list;
            default:
                return list;
        }
    }, [plugins, themesList, mode, searchQuery, sort]);

    if (error) {
        return (
            <View style={{ flex: 1, paddingHorizontal: 8, justifyContent: "center", alignItems: "center" }}>
                <Card style={{ gap: 8 }}>
                    <Text style={{ textAlign: "center" }} variant="heading-lg/bold">
                        An error occurred while fetching
                    </Text>
                    <Text style={{ textAlign: "center" }} variant="text-sm/medium" color="text-muted">
                        {error}
                    </Text>
                    <Button
                        size="lg"
                        text="Retry"
                        onPress={mode === "plugins" ? fetchPluginsData : fetchThemesData}
                        icon={findAssetId("RetryIcon")}
                    />
                </Card>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <View style={{ paddingHorizontal: 10 }}>
                <Stack spacing={12}>
                    <View style={{ flexDirection: "row", paddingTop: 10 }}>
                        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                            <Button
                                size="md"
                                text="Plugins"
                                variant={mode === "plugins" ? "primary" : "secondary"}
                                onPress={() => setMode("plugins")}
                                style={{ flex: 1 }}
                            />
                            <View style={{ width: 8 }} />
                            <Button
                                size="md"
                                text="Themes"
                                variant={mode === "themes" ? "primary" : "secondary"}
                                onPress={() => setMode("themes")}
                                style={{ flex: 1 }}
                            />
                        </View>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 6 }}>
                        <Search
                            placeholder={`Search ${mode}...`}
                            isRound={true}
                            onChangeText={setSearchQuery}
                            style={{ flex: 1 }}
                        />
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <IconButton
                                size="md"
                                variant="tertiary"
                                icon={findAssetId("MoreVerticalIcon")}
                                disabled={!!searchQuery}
                                onPress={() => showSimpleActionSheet({
                                    key: "AddonListSortOptions",
                                    header: {
                                        title: "Sort Options",
                                        onClose: () => hideActionSheet("AddonListSortOptions"),
                                    },
                                    options: Object.entries(Sort).map(([key, value]) => ({
                                        label: value,
                                        onPress: () => {
                                            setSort(value as Sort);
                                        }
                                    }))
                                })}
                            />
                        </View>
                    </View>
                </Stack>
            </View>

            <FlashList
                data={sortedAndFiltered}
                refreshing={loading}
                onRefresh={mode === "plugins" ? fetchPluginsData : fetchThemesData}
                estimatedItemSize={200}
                contentContainerStyle={{ paddingBottom: 90, paddingHorizontal: 5 }}
                ListHeaderComponent={mode === "plugins" ? (
                    <View style={{ paddingVertical: 6, paddingHorizontal: 8 }}>
                        <Card border="strong">
                            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", flexDirection: "row" }}>
                                <View style={{ gap: 6, flexShrink: 1 }}>
                                    <Text variant="heading-md/bold">Unproxied Plugins</Text>
                                    <Text variant="text-sm/medium" color="text-muted">
                                        Plugins installed from this source have not been checked for safety, install at your own risk
                                    </Text>
                                </View>
                            </View>
                        </Card>
                    </View>
                ) : null}
                //@ts-ignore
                renderItem={({ item: addon }) => (
                    <View style={{ paddingVertical: 6, paddingHorizontal: 8 }}>
                        <AddonCard
                            addon={addon}
                            isPluginMode={mode === "plugins"}
                            installing={installing}
                            setInstalling={setInstalling}
                            setRefreshTick={setRefreshTick}
                        />
                    </View>
                )}
            />
        </View>
    );
}
