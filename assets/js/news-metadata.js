        // --- Tab Switching Logic ---
        function switchTab(tabName) {
            const tabArticles = document.getElementById('tab-articles');
            const tabPrimary = document.getElementById('tab-primary');
            const contentArticles = document.getElementById('content-articles');
            const contentPrimary = document.getElementById('content-primary');

            if (tabName === 'articles') {
                tabArticles.classList.add('active');
                tabPrimary.classList.remove('active');
                contentArticles.classList.remove('hidden');
                contentPrimary.classList.add('hidden');
            } else {
                tabArticles.classList.remove('active');
                tabPrimary.classList.add('active');
                contentArticles.classList.add('hidden');
                contentPrimary.classList.remove('hidden');
            }
        }


        // Cleaned, canonical category database. Keep this list slash-free and title-cased.
        const categories = [
            "Abuse", "Accountability", "Aid Access", "Aid Blockade", "Aid Conflict",
            "Aid Crisis", "Aid Disaster", "Aid Disruption", "Aid Policy", "Aid Targeting",
            "Analysis", "Antisemitism", "Birth", "Birth Rates", "Business",
            "Ceasefire", "Children", "Civilian Casualties", "Conflict", "Conflict Escalation",
            "Conflict Reporting", "Crisis", "Culture", "Death Toll", "Destruction Plans",
            "Detention & Rights", "Diplomacy", "Disability", "Displacement", "Economic Crisis",
            "Economy", "Education", "Elderly", "Environment", "Ethnic Cleansing",
            "Extreme Rhetoric", "Famine", "Feminism", "Forced Displacement", "Foreign Policy",
            "Gaza", "Gaza Policy", "Genocide", "Genocide Accusations", "Genocide Allegation",
            "Genocide Allegations", "Genocide Analysis", "Health", "Healthcare Crisis",
            "Hostage Testimony", "Human Interest", "Human Rights", "Human Shields",
            "Humanitarian", "Humanitarian Aid", "Humanitarian Crisis", "Hunger Crisis",
            "Illegal Expansion", "Illegal Weaponry", "Incitement", "Infant Mortality",
            "Infants", "Intelligence", "International Appeal", "Israeli Politics", "Legal",
            "Legal Proceedings", "Living Conditions", "Maternal Mortality", "Media",
            "Media Coverage", "Media Ethics", "Media Freedom", "Media Restrictions",
            "Media Rights", "Medical Testimony", "Military", "Military Criticism",
            "Military Operations", "Military Plans", "Military Policy", "Military Technology",
            "Mothers", "Newborns", "Opinion", "Pregnant Women", "Political Controversy",
            "Political Criticism", "Political Discourse", "Political Statements", "Politics",
            "Press Freedom", "Prison Conditions", "Protests", "Psychological Warfare",
            "Public Opinion", "Reproductive Genocide", "Reproductive Justice",
            "Reproductive Rights", "Rhetoric", "Rights & Justice", "Rules of Engagement",
            "Security", "Settler Violence", "Sexual Violence", "Social Impact", "Sports",
            "Starvation", "Starvation Warning", "Targeting Civilians", "Targeting Healthcare",
            "Targeting Religious Sites", "Technology", "Transfer Support", "U.S. Politics",
            "UN Reports", "UN Warnings", "War Crimes", "War Objectives", "West Bank Violence",
            "Women", "Women and Children", "World"
        ].sort();

        const relatedCategorySuggestions = {
            famine: ["Starvation", "Hunger Crisis", "Humanitarian Crisis"],
            starvation: ["Famine", "Hunger Crisis", "Humanitarian Aid"],
            women: ["Mothers", "Pregnant Women", "Reproductive Justice", "Women and Children"],
            children: ["Infants", "Newborns", "Women and Children", "Children"],
            birth: ["Birth Rates", "Maternal Mortality", "Infant Mortality", "Newborns"],
            ceasefire: ["Diplomacy", "Conflict", "Humanitarian Aid"]
        };

        // Conservative, title-only matches give contributors a useful starting point
        // without trying to infer topics from ambiguous article text.
        const titleCategoryRules = [
            { category: "Genocide", patterns: [/\bgenocid(?:e|al|es)?\b/i, /\bethnic cleansing\b/i, /\breproductive genocide\b/i] },
            { category: "Starvation", patterns: [/\bstarv(?:e|es|ed|ing|ation)\b/i, /\bfamine\b/i, /\bhunger\b/i] },
            { category: "Ceasefire", patterns: [/\bcease[ -]?fire\b/i, /\btruce\b/i] },
            { category: "Displacement", patterns: [/\bdisplace(?:d|ment|ments)\b/i, /\bforc(?:ed|ible) displacement\b/i, /\bexpulsion\b/i] },
            { category: "Children", patterns: [/\bchildren\b/i, /\bchild\b/i, /\binfants?\b/i, /\bnewborns?\b/i] },
            { category: "Women", patterns: [/\bwomen\b/i, /\bmothers?\b/i, /\bpregnan(?:t|cy)\b/i] },
            { category: "Healthcare Crisis", patterns: [/\bhospitals?\b/i, /\bhealth ?care\b/i, /\bmedical\b/i, /\bdoctors?\b/i] },
            { category: "Aid Blockade", patterns: [/\baid blockade\b/i, /\baid (?:is )?blocked\b/i, /\bblock(?:ade|ing) aid\b/i] },
            { category: "Humanitarian Aid", patterns: [/\bhumanitarian aid\b/i, /\baid deliveries?\b/i, /\brelief (?:aid|supplies)\b/i] },
            { category: "War Crimes", patterns: [/\bwar crimes?\b/i, /\bcrime against humanity\b/i] },
            { category: "Legal Proceedings", patterns: [/\b(?:icj|icc|international court|lawsuit|court ruling|arrest warrant)\b/i] },
            { category: "Settler Violence", patterns: [/\bsettler(?:s)?\b/i, /\bwest bank violence\b/i] },
            { category: "Media Freedom", patterns: [/\bjournalists?\b/i, /\bpress freedom\b/i, /\bmedia (?:ban|blackout|restrictions?)\b/i] },
            { category: "Protests", patterns: [/\bprotests?\b/i, /\bdemonstrations?\b/i] },
            { category: "Military Operations", patterns: [/\b(?:airstrikes?|bomb(?:ing|ed)?|military operation|ground offensive)\b/i] }
        ];
        const defaultCategory = "Genocide";
        const submitterNameStorageKey = "echoesOfGaza.submitterName";

        function categoriesSuggestedByTitle(title) {
            const normalizedTitle = String(title || "").trim();
            if (!normalizedTitle) return [];
            return titleCategoryRules
                .filter(rule => rule.patterns.some(pattern => pattern.test(normalizedTitle)))
                .map(rule => rule.category);
        }

        // Color palette for categories (17 colors)
        const colors = [
            "#FF6B6B", "#4ECDC4", "#45B7D1", "#F9C80E", "#FF8811",
            "#F0E68C", "#98D8C8", "#B5EAD7", "#FFB7B2", "#77DD77",
            "#A2D2FF", "#C7CEEA", "#F3A683", "#F194B4", "#83D6E3",
            "#E0BBE4", "#D6EAF8"
        ];

        /**
         * Simple hash function to get a consistent index from a string.
         */
        function simpleHash(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            return Math.abs(hash);
        }

        /**
         * Gets a consistent color from the palette based on the category name.
         */
        function getCategoryColor(category) {
            const hash = simpleHash(category);
            const index = hash % colors.length;
            return colors[index];
        }

        const googleScriptWebAppUrl = 'https://script.google.com/macros/s/AKfycbyBnG6OCnoSwDea9fad4v6I2nx-7ioDa9uXCOY_0dbc6mmMcL5Nmiee7600fC4iH3Dj/exec';

        const SOURCE_IMAGE_URLS = {
            "Associated Press": "https://1000logos.net/wp-content/uploads/2016/10/Associated-Press-logo.jpg",
            "AP News": "https://1000logos.net/wp-content/uploads/2016/10/Associated-Press-logo.jpg",
            "Al Jazeera": "https://d10bt0812qicot.cloudfront.net/img/2a/df897cb5e34467bba62c7c6f85723d/640x360.png",
            "Axios": "https://uploads.concordia.net/2022/09/13152518/Axios-logo-RGB-1.jpg",
            "BBC": "https://ichef.bbci.co.uk/images/ic/1920x1080/p09xtmrp.jpg",
            "CNN": "https://images.icon-icons.com/167/PNG/512/cnn_23166.png",
            "Common Dreams": "https://www.greenamerica.org/sites/default/files/mediasource/2019-05/cd_stacked_white_facebook_commondreams.org_.png",
            "Democracy Now!": "https://upload.wikimedia.org/wikipedia/en/thumb/0/01/Democracy_Now%21_logo.svg/1200px-Democracy_Now%21_logo.svg.png",
            "Doctors Without Borders": "https://www.doctorswithoutborders.org/themes/custom/msf/meta_image.png",
            "Haaretz": "https://images.seeklogo.com/logo-png/50/1/haaretz-logo-png_seeklogo-507234.png",
            "Human Rights Watch": "https://www.hrw.org/sites/default/files/styles/opengraph/public/media_2023/12/202312mena_palestine_displacement_gaza.jpg?h=4362216e&itok=8Py7LuI1",
            "Middle East Eye": "https://yt3.googleusercontent.com/ytc/AIdro_lRzIchs74TuzdT7g_vmgeoD_KFN5kmLk_I3GlVmBl8Z_g=s900-c-k-c0x00ffffff-no-rj",
            "NBC News": "https://cdn.worldvectorlogo.com/logos/nbc-news.svg",
            "NPR": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/National_Public_Radio_logo.svg/2560px-National_Public_Radio_logo.svg.png",
            "PBS": "https://d3i6fh83elv35t.cloudfront.net/static/2025/05/2025-05-26T180739Z_2118340861_RC2SPEAF7CGO_RTRMADP_3_ISRAEL-PALESTINIANS-JERUSALEM-DAY-MARCH-1024x683.jpg",
            "PBS NewsHour": "https://d3i6fh83elv35t.cloudfront.net/static/2025/05/2025-05-26T180739Z_2118340861_RC2SPEAF7CGO_RTRMADP_3_ISRAEL-PALESTINIANS-JERUSALEM-DAY-MARCH-1024x683.jpg",
            "Reuters": "https://i0.wp.com/janoberg.me/wp-content/uploads/2023/05/logo-Reuters.jpg?fit=5000%2C2435&ssl=1",
            "The Cradle": "https://thecradle-main.oss-eu-central-1.aliyuncs.com/public/articles/acee9a02-9911-11ee-aecb-00163e02c055.png",
            "The Guardian": "https://assets-legacy.floridarrc.com/2023/01/the-guardian-logo.jpeg",
            "The Independent": "https://static.the-independent.com/2025/05/06/15/26/SEI249805010.jpeg?quality=75&width=1368&auto=webp",
            "The Jerusalem Post": "https://tiif.org/wp-content/uploads/2018/07/t-j-p-logo.jpg",
            "Jerusalem Post": "https://tiif.org/wp-content/uploads/2018/07/t-j-p-logo.jpg",
            "The New York Times": "https://ropercenter.cornell.edu/sites/default/files/styles/800x600/public/Images/New-York-Times-Logo8x6_0.png?itok=7YqGOSMA",
            "New York Times": "https://ropercenter.cornell.edu/sites/default/files/styles/800x600/public/Images/New-York-Times-Logo8x6_0.png?itok=7YqGOSMA",
            "The Times of Israel": "https://play-lh.googleusercontent.com/5RXKeNxLAMc60xycN3PSvoxwEY8Pp9iiZH2stMxmh9YoL6YOa7wSYPMA-w1vpYM7rg",
            "Times of Israel": "https://play-lh.googleusercontent.com/5RXKeNxLAMc60xycN3PSvoxwEY8Pp9iiZH2stMxmh9YoL6YOa7wSYPMA-w1vpYM7rg",
            "The Washington Post": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS7j0eNkVqKnqU-vTMmkAm9yA0BaSqkkmZltw&s",
            "Washington Post": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS7j0eNkVqKnqU-vTMmkAm9yA0BaSqkkmZltw&s",
            "UN News": "https://global.unitednations.entermediadb.net/assets/mediadb/services/module/asset/downloads/preset/Collections/Embargoed/04-09-2024-UNICEF-Gaza-10.jpg/image1170x530cropped.jpg",
            "UN Office of the High Commissioner for Human Rights": "https://www.hrw.org/sites/default/files/styles/opengraph/public/media_2024/12/202412mena_gaza_khanyounis_water.jpg?h=2fd8615c&itok=epQ79D7J",
            "Vox": "https://upload.wikimedia.org/wikipedia/commons/e/e5/Vox_%28website%29_logo.jpg"
        };

        function normalizeSourceName(source) {
            const value = String(source || "").trim();
            const aliases = {
                "AP": "Associated Press",
                "AP News": "Associated Press",
                "NYT": "The New York Times",
                "New York Times": "The New York Times",
                "Times of Israel": "The Times of Israel",
                "Washington Post": "The Washington Post",
                "JPost": "The Jerusalem Post",
                "Jerusalem Post": "The Jerusalem Post"
            };

            return aliases[value] || value;
        }

        function getImageUrlForSource(source) {
            return getKnownImageUrlForSource(source) || "https://placeholder.com/image.jpg";
        }

        function getKnownImageUrlForSource(source) {
            const normalized = normalizeSourceName(source);
            return SOURCE_IMAGE_URLS[normalized] || SOURCE_IMAGE_URLS[source] || "";
        }

        // Domain -> source name. Seeded with common outlets (names match
        // SOURCE_IMAGE_URLS so the source image fills too) and then enriched at
        // runtime from the existing article library (data/articles.json). Used to
        // recognize a source from the link when the live fetch is blocked.
        const BASE_DOMAIN_SOURCES = {
            "apnews.com": "Associated Press",
            "aljazeera.com": "Al Jazeera",
            "archivegenocide.com": "Genocide Archive (Israel Exposed)",
            "axios.com": "Axios",
            "bbc.com": "BBC", "bbc.co.uk": "BBC",
            "cnn.com": "CNN",
            "commondreams.org": "Common Dreams",
            "democracynow.org": "Democracy Now!",
            "doctorswithoutborders.org": "Doctors Without Borders", "msf.org": "Doctors Without Borders",
            "haaretz.com": "Haaretz",
            "hrw.org": "Human Rights Watch",
            "middleeasteye.net": "Middle East Eye",
            "nbcnews.com": "NBC News",
            "npr.org": "NPR",
            "pbs.org": "PBS",
            "reuters.com": "Reuters",
            "thecradle.co": "The Cradle",
            "theguardian.com": "The Guardian",
            "independent.co.uk": "The Independent",
            "jpost.com": "The Jerusalem Post",
            "nytimes.com": "The New York Times",
            "timesofisrael.com": "The Times of Israel",
            "washingtonpost.com": "The Washington Post",
            "news.un.org": "UN News", "un.org": "UN News",
            "ohchr.org": "UN Office of the High Commissioner for Human Rights",
            "vox.com": "Vox"
        };
        const sourceByDomain = new Map(Object.entries(BASE_DOMAIN_SOURCES));

        function domainKeyForUrl(url) {
            try {
                return new URL(String(url).trim()).hostname.toLowerCase().replace(/^www\./, "");
            } catch (error) {
                return "";
            }
        }

        function learnSourceDomainsFromLibrary(articles) {
            const counts = {};
            articles.forEach((article) => {
                const domain = domainKeyForUrl(article.link);
                const source = String(article.source || "").trim();
                if (!domain || !source) return;
                counts[domain] = counts[domain] || {};
                counts[domain][source] = (counts[domain][source] || 0) + 1;
            });
            Object.entries(counts).forEach(([domain, srcCounts]) => {
                if (sourceByDomain.has(domain)) return; // curated base map wins
                const best = Object.entries(srcCounts).sort((a, b) => b[1] - a[1])[0][0];
                sourceByDomain.set(domain, best);
            });
        }

        function inferSourceFromUrl(url) {
            const host = domainKeyForUrl(url);
            if (!host) return "";
            if (sourceByDomain.has(host)) return sourceByDomain.get(host);
            // Try progressively shorter registrable domains (e.g. edition.cnn.com -> cnn.com).
            const parts = host.split(".");
            for (let i = 1; i < parts.length - 1; i += 1) {
                const candidate = parts.slice(i).join(".");
                if (sourceByDomain.has(candidate)) return sourceByDomain.get(candidate);
            }
            return "";
        }

        function resolveSourceNameForArticle(url, reportedSource = "") {
            // A known URL is more reliable than a provider's display string (which
            // can be a hostname such as "commondreams.org").
            return inferSourceFromUrl(url) || normalizeSourceName(reportedSource);
        }

        function todayIsoDate() {
            return new Date().toISOString().split('T')[0];
        }

        function cleanMetadataValue(value) {
            return String(value || "")
                .replace(/\s+/g, " ")
                .replace(/^[\s|•·:-]+|[\s|•·:-]+$/g, "")
                .trim();
        }

        function cleanAuthorMetadata(value) {
            const raw = cleanMetadataValue(value).replace(/^by\s+/i, "");
            if (!raw || /(?:https?:\/\/|www\.|\.com\b|\.org\b|\.net\b|\/author\/)/i.test(raw)) return "";

            // Only retain identifiable person bylines. Generic publisher labels
            // frequently appear in metadata but are not an author attribution.
            const names = raw.split(/\s*(?:;|\band\b)\s*/i).map(name => name.trim()).filter(name => {
                if (name.length < 3 || name.length > 90) return false;
                if (/\b(staff|team|desk|newsroom|editorial|administrator|admin|unknown|author|press office|contributors?)\b/i.test(name)) return false;
                return /^[\p{L}][\p{L}\p{M}'’.-]*(?:\s+[\p{L}][\p{L}\p{M}'’.-]*)+$/u.test(name);
            });
            return [...new Set(names)].join(", ");
        }

        function getMetaContent(doc, selectors) {
            for (const selector of selectors) {
                const element = doc.querySelector(selector);
                const content = element?.getAttribute("content") || element?.textContent;
                const value = cleanMetadataValue(content);
                if (value) return value;
            }
            return "";
        }

        function normalizeMetadataDate(value) {
            const cleanValue = cleanMetadataValue(value);
            if (!cleanValue) return "";
            const parsed = new Date(cleanValue);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed.toISOString().split("T")[0];
            }
            const match = cleanValue.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
            if (!match) return "";
            const [, year, month, day] = match;
            return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }

        function sourceNameFromUrl(url) {
            try {
                const hostname = new URL(url).hostname.replace(/^www\./, "");
                const base = hostname.split(".").slice(0, -1).join(" ") || hostname;
                return base
                    .split(/[\s.-]+/)
                    .filter(Boolean)
                    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                    .join(" ");
            } catch (error) {
                return "";
            }
        }

        function inferDocumentType(url, metadataType) {
            const combined = `${url} ${metadataType}`.toLowerCase();
            if (/press[-_\s]?release|newsroom|statement/.test(combined)) return "Press release";
            if (/blog|opinion|commentisfree|essay/.test(combined)) return "Blog";
            if (/twitter\.com|x\.com|instagram\.com|facebook\.com|tiktok\.com|threads\.net/.test(combined)) return "Social media post";
            return "Article";
        }

        function absolutizeUrl(value, pageUrl) {
            const cleanValue = cleanMetadataValue(value);
            if (!cleanValue) return "";
            try {
                return new URL(cleanValue, pageUrl).href;
            } catch (error) {
                return cleanValue;
            }
        }


        function cleanArticleTitle(title, source) {
            const cleanTitle = cleanMetadataValue(title);
            const cleanSource = cleanMetadataValue(source);
            if (!cleanTitle || !cleanSource) return cleanTitle;
            const escapedSource = cleanSource.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            return cleanTitle.replace(new RegExp(`\\s*(?:[|\\-–—])\\s*${escapedSource}\\s*$`, "i"), "").trim();
        }

        function extractArticleMetadata(html, pageUrl) {
            const doc = new DOMParser().parseFromString(html, "text/html");
            const metadataType = getMetaContent(doc, [
                'meta[property="og:type"]',
                'meta[name="twitter:label1"]'
            ]);
            const title = getMetaContent(doc, [
                'meta[property="og:title"]',
                'meta[name="twitter:title"]',
                'meta[name="parsely-title"]',
                'meta[name="dc.title"]',
                'meta[name="title"]',
                'title'
            ]);
            const metaSource = getMetaContent(doc, [
                'meta[property="og:site_name"]',
                'meta[name="application-name"]',
                'meta[name="publisher"]',
                'meta[property="article:publisher"]'
            ]);
            const authors = getMetaContent(doc, [
                'meta[name="author"]',
                'meta[property="article:author"]',
                'meta[name="parsely-author"]',
                'meta[name="byl"]',
                'meta[name="dc.creator"]',
                'meta[itemprop="author"]',
                '[rel="author"]'
            ]).replace(/^by\s+/i, "");
            const date = normalizeMetadataDate(getMetaContent(doc, [
                'meta[property="article:published_time"]',
                'meta[name="article:published_time"]',
                'meta[name="date"]',
                'meta[name="pubdate"]',
                'meta[name="publishdate"]',
                'meta[name="publication_date"]',
                'meta[name="parsely-pub-date"]',
                'meta[itemprop="datePublished"]',
                'time[datetime]'
            ]) || doc.querySelector('time[datetime]')?.getAttribute('datetime'));
            const summary = getMetaContent(doc, [
                'meta[property="og:description"]',
                'meta[name="twitter:description"]',
                'meta[name="description"]',
                'meta[name="parsely-summary"]'
            ]);
            const imageUrl = absolutizeUrl(getMetaContent(doc, [
                'meta[property="og:image:secure_url"]',
                'meta[property="og:image"]',
                'meta[name="twitter:image"]',
                'meta[name="thumbnail"]',
                'meta[itemprop="image"]'
            ]), pageUrl);

            // JSON-LD (schema.org NewsArticle/Article/BlogPosting) is far more
            // reliable than meta tags on many outlets — and often carries the
            // author and publish date that meta tags omit. Use it to fill gaps.
            const ld = extractJsonLdMetadata(doc);
            // Prefer real publisher metadata, then JSON-LD, then the curated
            // domain map (gives canonical names like "The Guardian"), and only
            // fall back to a hostname guess as a last resort.
            const resolvedSource = metaSource || ld.source || inferSourceFromUrl(pageUrl) || sourceNameFromUrl(pageUrl);

            return {
                title: cleanArticleTitle(title || ld.title, resolvedSource),
                source: resolvedSource,
                authors: authors || ld.authors,
                date: date || ld.date,
                summary: summary || ld.summary,
                imageUrl: imageUrl || absolutizeUrl(ld.imageUrl, pageUrl),
                documentType: inferDocumentType(pageUrl, metadataType || ld.documentType)
            };
        }

        function ldTypeIncludes(type, regex) {
            if (Array.isArray(type)) return type.some(entry => regex.test(String(entry)));
            return regex.test(String(type || ""));
        }

        function flattenLdNodes(parsed, accumulator) {
            if (!parsed || typeof parsed !== "object") return;
            if (Array.isArray(parsed)) {
                parsed.forEach(node => flattenLdNodes(node, accumulator));
                return;
            }
            accumulator.push(parsed);
            if (Array.isArray(parsed["@graph"])) {
                parsed["@graph"].forEach(node => flattenLdNodes(node, accumulator));
            }
        }

        function ldImageUrl(image) {
            if (!image) return "";
            if (typeof image === "string") return image;
            if (Array.isArray(image)) return ldImageUrl(image[0]);
            return image.url || image.contentUrl || "";
        }

        function ldAuthorNames(author) {
            if (!author) return "";
            if (typeof author === "string") return author;
            if (Array.isArray(author)) return author.map(ldAuthorNames).filter(Boolean).join(", ");
            return author.name || "";
        }

        function ldPublisherName(publisher) {
            if (!publisher) return "";
            if (typeof publisher === "string") return publisher;
            if (Array.isArray(publisher)) return ldPublisherName(publisher[0]);
            return publisher.name || "";
        }

        function extractJsonLdMetadata(doc) {
            const out = { title: "", source: "", authors: "", date: "", summary: "", imageUrl: "", documentType: "" };
            const nodes = [];
            doc.querySelectorAll('script[type="application/ld+json"]').forEach(block => {
                const raw = (block.textContent || "").trim();
                if (!raw) return;
                try {
                    flattenLdNodes(JSON.parse(raw), nodes);
                } catch (error) {
                    // Some publishers emit trailing commas or stray markup; retry leniently.
                    try {
                        flattenLdNodes(JSON.parse(raw.replace(/,\s*([}\]])/g, "$1")), nodes);
                    } catch (innerError) { /* ignore malformed block */ }
                }
            });
            if (!nodes.length) return out;
            const article = nodes.find(node => ldTypeIncludes(node["@type"], /article|posting|report/i) && (node.headline || node.name))
                || nodes.find(node => node.headline || node.name)
                || {};
            out.title = cleanMetadataValue(article.headline || article.name);
            out.summary = cleanMetadataValue(article.description || article.abstract);
            out.date = normalizeMetadataDate(article.datePublished || article.dateCreated || article.dateModified);
            out.imageUrl = cleanMetadataValue(ldImageUrl(article.image));
            out.authors = cleanMetadataValue(ldAuthorNames(article.author)).replace(/^by\s+/i, "");
            out.source = cleanMetadataValue(ldPublisherName(article.publisher));
            if (ldTypeIncludes(article["@type"], /blogposting/i)) out.documentType = "Blog";
            return out;
        }

        async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
            const controller = new AbortController();
            const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await fetch(url, { ...options, signal: controller.signal });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.text();
            } finally {
                window.clearTimeout(timeout);
            }
        }

        function looksLikeArticleHtml(text) {
            return typeof text === "string" && /<\s*(meta|title|html|head)\b/i.test(text);
        }

        async function fetchArticleHtml(url) {
            // Most publishers block direct cross-origin requests, so fall back through
            // several public CORS proxies. Order matters: try direct first (works for
            // permissive sites), then the most reliable proxies. Each candidate is
            // validated to be real HTML before accepting it.
            const proxyUrls = [
                url,
                `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
                `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
                `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
                `https://thingproxy.freeboard.io/fetch/${url}`
            ];
            // Probe all routes at once. This ensures every fetch gets a real attempt
            // while keeping one slow or blocked proxy from holding up the form.
            const attempts = proxyUrls.map(requestUrl =>
                fetchWithTimeout(requestUrl, {}, 9000).then(text => {
                    if (!looksLikeArticleHtml(text)) throw new Error("Response did not contain readable page HTML.");
                    return text;
                })
            );
            return Promise.any(attempts);
        }

        // Structured fallback. When scraping the page HTML fails or yields almost
        // nothing (paywalls, JS-rendered pages, aggressive bot blocking), Microlink
        // resolves the same metadata server-side and returns clean JSON. This is the
        // main reliability win for sites that the proxy+meta path can't read.
        async function fetchMicrolinkMetadata(url) {
            const text = await fetchWithTimeout(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, {}, 12000);
            const json = JSON.parse(text);
            if (!json || json.status !== "success" || !json.data) {
                throw new Error("Microlink returned no usable data.");
            }
            const data = json.data;
            return {
                title: cleanMetadataValue(data.title),
                source: cleanMetadataValue(data.publisher),
                authors: cleanAuthorMetadata(data.author),
                date: normalizeMetadataDate(data.date),
                summary: cleanMetadataValue(data.description),
                imageUrl: cleanMetadataValue(data.image && data.image.url) || cleanMetadataValue(data.logo && data.logo.url),
                documentType: inferDocumentType(url, "")
            };
        }

        // Fill empty fields of `primary` from `secondary` without overwriting hits.
        function mergeMetadata(primary, secondary) {
            const merged = { ...(primary || {}) };
            Object.keys(secondary || {}).forEach(key => {
                const value = key === "authors" ? cleanAuthorMetadata(secondary[key]) : secondary[key];
                if (!merged[key] && isUsableMetadataValue(value)) merged[key] = value;
            });
            return merged;
        }

        function isUsableMetadataValue(value) {
            const normalized = cleanMetadataValue(value).toLowerCase();
            return Boolean(normalized) && !/\b(access denied|forbidden|fordbidden|just a moment|error\s*\d{3}|\d{3}\s*(?:forbidden|error))\b/.test(normalized);
        }

        // A result is "thin" if we couldn't even get a title, or got a title but
        // little else — in those cases it's worth spending a request on the fallback.
        function metadataIsThin(metadata) {
            if (!metadata || !metadata.title) return true;
            const populated = ["summary", "imageUrl", "authors", "date"].filter(key => metadata[key]).length;
            return populated < 2;
        }

        function escapeHtml(value) {
            return String(value).replace(/[&<>"']/g, character => ({
                "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
            }[character]));
        }

        function isProbablyUrl(value) {
            try {
                const parsed = new URL(value);
                return parsed.protocol === "http:" || parsed.protocol === "https:";
            } catch (error) {
                return false;
            }
        }

        function parseLinkList(text) {
            const seen = new Set();
            const urls = [];
            String(text || "")
                .split(/\s+|,(?=https?:\/\/)/i)
                .map(token => token.trim().replace(/,$/, ''))
                .filter(Boolean)
                .forEach(token => {
                    if (isProbablyUrl(token) && !seen.has(token)) {
                        seen.add(token);
                        urls.push(token);
                    }
                });
            return urls;
        }

        async function runWithConcurrency(items, limit, worker) {
            let cursor = 0;
            async function next() {
                const index = cursor++;
                if (index >= items.length) return;
                await worker(items[index], index);
                return next();
            }
            await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
        }

        function domainLabel(url) {
            try {
                return new URL(url).hostname.replace(/^www\./, "");
            } catch (error) {
                return url;
            }
        }

        function parseAuthors(authorsValue, isUnknown) {
            const authors = isUnknown
                ? ["Unknown author"]
                : String(authorsValue || "")
                    .split(/\s*(?:,|;| and )\s*/i)
                    .map(author => author.trim())
                    .filter(Boolean);
            return authors.length ? authors : ["Unknown author"];
        }

        function parseCategoryList(primaryCategory, additionalCategories = '') {
            const categoriesFromInput = String(additionalCategories || '')
                .split(',')
                .map(category => category.trim())
                .filter(Boolean);
            return [...new Set([primaryCategory, ...categoriesFromInput].filter(Boolean))];
        }

        function buildArticlePayload(entryData) {
            const categoryList = parseCategoryList(entryData.primaryCategory, entryData.additionalCategories);
            const primaryCategory = categoryList[0];
            const normalizedAuthors = parseAuthors(entryData.authors, entryData.unknownAuthor);
            return {
                action: "submitArticle",
                status: "pending",
                type: "secondary_source",
                submittedAt: new Date().toISOString(),
                submitted_by: entryData.submitterName,
                date: entryData.date,
                title: entryData.title,
                summary: entryData.summary || "",
                link: entryData.link,
                imageUrl: entryData.imageUrl || getImageUrlForSource(entryData.source),
                category: primaryCategory,
                categories: categoryList,
                categoryColor: getCategoryColor(primaryCategory),
                source: normalizeSourceName(entryData.source),
                author: normalizedAuthors.join(', '),
                authors: normalizedAuthors,
                documentType: entryData.documentType
            };
        }

