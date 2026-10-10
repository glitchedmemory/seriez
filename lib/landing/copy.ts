/**
 * Landing page copy for the two "alternative" pages, in every language the site supports.
 * Keep the structure identical across languages: the page components read positions, not text.
 */

export interface LandingCopy {
  meta: { title: string; description: string };
  eyebrow: string;
  h1: string;
  lead: string;
  ctaPrimary: string;
  ctaSecondary: string;
  ctaOther: string;
  section1: { title: string; lead?: string; items: { t: string; b: string }[] };
  section2: {
    title: string;
    cols?: { title: string; items: string[] }[];
    body?: string;
    body2?: string;
    note?: string;
  };
  section3?: { title: string; items: { t: string; b: string }[] };
  section4: { title: string; items: { n: string; b: string }[]; note: string };
  faq: { title: string; items: { q: string; a: string }[] };
  final: { title: string; body: string; cta: string; other: string };
}

export const LANDING_LOCALES = ["en", "ko", "ja", "zh", "fr", "de", "es", "pt"] as const;
export type LandingLocale = (typeof LANDING_LOCALES)[number];

const enTv: LandingCopy = {
  meta: {
    title: "TV Time Alternative: Import Your Watch History",
    description:
      "TV Time shut down on July 15, 2026. Bring your watch history to Seriez with a CSV import from your TV Time export, and track movies, TV shows, and anime in one place.",
  },
  eyebrow: "TV TIME ALTERNATIVE",
  h1: "TV Time is gone. Your watch history does not have to be.",
  lead: "TV Time shut down on July 15, 2026, and took thirteen years of episode check ins, ratings, and lists with it. If you saved your data export in time, you can bring it to Seriez in a few minutes: import the file, keep your history, and track movies, TV shows, and anime in one library from now on.",
  ctaPrimary: "Create a free account",
  ctaSecondary: "Go to Import CSV",
  ctaOther: "Also track films? See the Letterboxd comparison",
  section1: {
    title: "Bring your TV Time history across",
    lead: "The import takes your file as it came out of TV Time. No reformatting, no third party tool.",
    items: [
      {
        t: "Find the CSV you exported",
        b: "TV Time sent two files: tracking-prod-records-v2.csv for shows and episodes, and tracking-prod-records.csv for movies. If you missed the export window, the files are gone, but you can still start a fresh library here.",
      },
      {
        t: "Create your Seriez account",
        b: "Free, no app store download. On a phone you can add Seriez to your home screen so it opens like an app.",
      },
      {
        t: "Drop the file into Settings",
        b: "Settings, then Data, then Import CSV. Your watched episodes, ratings, and favorites land in your library, and your progress bars on shows pick up where TV Time left them.",
      },
    ],
  },
  section2: {
    title: "What travels, and what does not",
    cols: [
      {
        title: "Comes with you",
        items: [
          "Every episode you had marked watched",
          "Shows you were in the middle of",
          "Movies you had tracked",
          "Your ratings and favorites",
        ],
      },
      {
        title: "Cannot come with you",
        items: ["Episode comments and reactions", "GIF threads and community posts", "Followers and your old profile"],
      },
    ],
    note:
      "TV Time never exported those, and the servers are gone. What you can do here is start the conversations again: every title has a review section, and your ratings feed everyone else's discovery.",
  },
  section3: {
    title: "Why people are moving here",
    items: [
      {
        t: "Movies, TV, and anime in one library.",
        b: "Letterboxd covers films only. Seriez keeps all three together, so you stop maintaining two or three separate lists.",
      },
      {
        t: "Anime that is actually correct.",
        b: "Anime data comes from AniList, so season and episode structure is real, not approximated from a TV database.",
      },
      {
        t: "Episode level progress.",
        b: "Check off episodes as you watch and see how far into a season you are, the same habit TV Time built.",
      },
      {
        t: "Discovery that uses your ratings.",
        b: "The For You section reads your history and suggests what to watch next instead of showing the same popular list to everyone.",
      },
      {
        t: "A year in review you can show off.",
        b: "Golden Ticket members get a yearly recap with hours watched, top genres, and your best rated titles.",
      },
    ],
  },
  section4: {
    title: "Where Seriez fits among the alternatives",
    items: [
      {
        n: "Trakt",
        b: "A long running tracker with deep media server integrations and a strong API. Best if your setup already runs through Plex or Kodi, and some features sit behind the paid VIP tier.",
      },
      {
        n: "Simkl",
        b: "The closest match to TV Time's mobile feel, with automatic tracking from streaming services. Its servers struggled under the surge of people arriving in July.",
      },
      {
        n: "Serializd",
        b: "A Letterboxd style home for television, built around reviews and a clean feed. Television only, so your films and anime live somewhere else.",
      },
      {
        n: "Bingers",
        b: "Built by the developer behind TV Time, which is why so much of the community landed there. Its comment sections are the closest thing to the old episode threads.",
      },
    ],
    note: "Seriez is the one that treats all three media types as first class, and it is the only one on this list where anime comes from AniList rather than a film and TV database.",
  },
  faq: {
    title: "Questions people ask first",
    items: [
      {
        q: "Is Seriez free?",
        a: "Yes. Creating an account, tracking what you watch, rating, reviewing, and importing your TV Time history are all free. Golden Ticket is an optional paid tier for extras such as unlimited collections and published lists.",
      },
      {
        q: "Do I need to install an app?",
        a: "No. Seriez runs in your browser, and you can add it to your phone's home screen so it opens like an app. There is nothing to download from an app store.",
      },
      {
        q: "Which TV Time file do I need?",
        a: "The CSV files from your TV Time data export. TV Time exported two files: tracking-prod-records-v2.csv for your shows and episodes, and tracking-prod-records.csv for your movies. Import one after the other in Settings.",
      },
      {
        q: "Can I import from Trakt, IMDb, or Letterboxd too?",
        a: "Not today. TV Time CSV import is the importer Seriez supports right now.",
      },
      {
        q: "What happened to my TV Time comments and reactions?",
        a: "They were deleted with the app. TV Time never exported comments, GIF reactions, or the community threads around episodes, so no service can bring them back. Ratings, watch history, and favorites are the parts that travel.",
      },
      {
        q: "Does Seriez track anime too?",
        a: "Yes. Anime data comes from AniList, so seasons and episode counts are correct rather than guessed, and anime sits in the same library as your films and series.",
      },
    ],
  },
  final: {
    title: "Start with the file you already have",
    body: "Create an account, import your export, and your library is back in a few minutes. If you never got your data out of TV Time, start empty. The tracking works the same either way.",
    cta: "Create a free account",
    other: "See the Letterboxd comparison",
  },
};

const enLb: LandingCopy = {
  meta: {
    title: "Letterboxd Alternative for TV Shows and Anime",
    description:
      "Letterboxd is films only. Seriez tracks films, TV shows, and anime in one library, with episode progress, ratings, reviews, collections, and a yearly recap.",
  },
  eyebrow: "LETTERBOXD ALTERNATIVE",
  h1: "Love Letterboxd, but your watchlist is not only films?",
  lead: "Letterboxd is films, by design. So the series you are six seasons into live in one app, the anime lives in another, and the films live here. Seriez puts all three in one library, keeps the diary habit you already have, and adds episode level progress for the shows.",
  ctaPrimary: "Create a free account",
  ctaSecondary: "Coming from TV Time instead",
  ctaOther: "Look around first",
  section1: {
    title: "One library for everything you watch",
    items: [
      {
        t: "Films, with the parts that matter",
        b: "Rate what you finish, write a review, mark favorites, and build collections. Posters, cast, and runtime come from TMDB, the same source Letterboxd uses for its film data.",
      },
      {
        t: "Series, down to the episode",
        b: "Follow shows, check off episodes as you go, and see your progress per season. When a new season premieres it lands in your feed, so you are not hunting for release dates.",
      },
      {
        t: "Anime, from AniList",
        b: "Anime has its own season and episode structure that a film database cannot express. Seriez reads anime from AniList, so a split cour does not turn into a duplicate or a wrong episode count.",
      },
      {
        t: "Recommendations that use your history",
        b: "The For You section is built from what you rated and finished, across all three media types, instead of handing every visitor the same chart.",
      },
    ],
  },
  section2: {
    title: "Where Letterboxd is still better",
    body: "Being honest about this saves you time. Letterboxd has a film writing culture and a community that took fifteen years to build: the reviews are essays, the lists are their own genre, and the annual stats are something people look forward to. Seriez is smaller and newer. If film criticism and list making are the reason you show up, Letterboxd remains the better home for that, and many people here keep both accounts.",
    body2:
      "What Letterboxd deliberately does not do is television and anime. That gap is what Seriez fills. If your habit is a film diary plus five shows plus the season's anime, one library beats three.",
  },
  section4: {
    title: "Side by side, in plain terms",
    items: [
      {
        n: "Films",
        b: "Both. Letterboxd has the deeper film community. Seriez has the same tracking basics and puts them next to everything else you watch.",
      },
      {
        n: "TV shows with episode progress",
        b: "Seriez only. Letterboxd covers films exclusively, which is why episode tracking does not exist there.",
      },
      { n: "Anime", b: "Seriez only, sourced from AniList with real season and episode structure." },
      {
        n: "Yearly recap",
        b: "Both offer one. Yours here can cover films, series, and anime in a single recap instead of films alone.",
      },
      {
        n: "Importing an existing diary",
        b: "Letterboxd import is not available yet. TV Time CSV import is, if you are arriving from there.",
      },
    ],
    note: "",
  },
  faq: {
    title: "Questions people ask first",
    items: [
      {
        q: "Is Seriez a full replacement for Letterboxd?",
        a: "For tracking and rating, yes: films get the same treatment here. What Seriez does not have is Letterboxd's film writing culture, its decades of lists, and the size of its community. Plenty of people keep both, and that is a reasonable setup.",
      },
      {
        q: "Does Seriez track TV episodes?",
        a: "Yes. You check off episodes as you watch them, and each show shows how far into the season you are. Letterboxd does not do this because it covers films only.",
      },
      {
        q: "How does the anime tracking work?",
        a: "Anime comes from AniList, so seasons, episode counts, and specials follow the real structure instead of being approximated from a film and TV database. Anime shares a library with your films and series.",
      },
      {
        q: "Can I import my Letterboxd history?",
        a: "Not today. TV Time CSV import is the only importer Seriez supports right now, and your Letterboxd films would need to be re-added by hand.",
      },
      {
        q: "Is it free?",
        a: "Yes. Accounts, tracking, ratings, reviews, and comments are free. Golden Ticket is an optional paid tier for extras such as unlimited collections, published lists, and the yearly recap.",
      },
    ],
  },
  final: {
    title: "Bring the whole habit to one place",
    body: "Rate the film you watched last night, check off tonight's episode, and add the anime season you are three episodes into. One library, one recap at the end of the year.",
    cta: "Create a free account",
    other: "Look around first",
  },
};

const koTv: LandingCopy = {
  meta: {
    title: "TV Time 대안: 시청 기록 그대로 옮기기",
    description:
      "TV Time은 2026년 7월 15일에 서비스를 종료했습니다. 내보낸 CSV 파일을 Seriez로 가져오면 시청 기록을 그대로 이어가며 영화, 티비, 애니를 한 곳에서 기록할 수 있습니다.",
  },
  eyebrow: "TV TIME 대안",
  h1: "TV Time은 사라졌지만, 시청 기록은 남길 수 있습니다.",
  lead: "TV Time은 2026년 7월 15일 문을 닫으며 13년치 에피소드 체크 기록과 평점, 리스트를 함께 가져갔습니다. 미리 데이터를 내려받아 두셨다면 Seriez로 몇 분 만에 옮길 수 있습니다. 파일을 가져오고, 기록은 유지하고, 앞으로 영화와 티비, 애니를 한 라이브러리에서 관리하시면 됩니다.",
  ctaPrimary: "무료로 계정 만들기",
  ctaSecondary: "CSV 가져오기로 이동",
  ctaOther: "영화도 함께 기록하시겠습니까? 레터박스 비교 보기",
  section1: {
    title: "TV Time 기록 옮기기",
    lead: "TV Time에서 받은 파일 그대로 가져옵니다. 형식을 고치거나 다른 도구를 쓸 필요가 없습니다.",
    items: [
      {
        t: "내려받아 둔 CSV 파일 찾기",
        b: "TV Time은 두 개의 파일을 보냈습니다. 티비와 에피소드는 tracking-prod-records-v2.csv, 영화는 tracking-prod-records.csv입니다. 내려받기 기간을 놓치셨다면 파일은 사라졌지만, 이곳에서 새로 시작하실 수 있습니다.",
      },
      {
        t: "Seriez 계정 만들기",
        b: "무료이고 앱스토어에서 받을 것도 없습니다. 휴대폰에서는 홈 화면에 추가하면 앱처럼 열립니다.",
      },
      {
        t: "설정에서 파일 넣기",
        b: "Settings의 Data에서 Import CSV를 누르고 파일을 넣으시면 됩니다. 봤던 에피소드와 평점, 즐겨찾기가 라이브러리로 들어오고, 보던 작품의 진행 표시가 TV Time에서 멈춘 지점부터 이어집니다.",
      },
    ],
  },
  section2: {
    title: "옮겨지는 것과 옮겨지지 않는 것",
    cols: [
      {
        title: "그대로 옮겨집니다",
        items: ["봤다고 표시한 모든 에피소드", "보다 만 작품의 진행 상황", "기록해 둔 영화", "평점과 즐겨찾기"],
      },
      {
        title: "옮길 수 없습니다",
        items: ["에피소드별 댓글과 반응", "GIF로 주고받던 글과 커뮤니티 게시물", "팔로워와 예전 프로필"],
      },
    ],
    note:
      "이 항목들은 TV Time이 내보내지 않았고 서버도 사라졌기 때문에 어떤 서비스도 되살릴 수 없습니다. 대신 여기서 대화를 다시 시작하실 수 있습니다. 모든 작품에 리뷰 공간이 있고, 남긴 평점은 다른 사람의 발견에 쓰입니다.",
  },
  section3: {
    title: "사람들이 이곳으로 오는 이유",
    items: [
      {
        t: "영화와 티비, 애니를 한 라이브러리에.",
        b: "레터박스는 영화만 다룹니다. Seriez는 세 가지를 함께 두기 때문에 목록을 두세 개로 나눠 관리할 필요가 없습니다.",
      },
      {
        t: "제대로 된 애니 정보.",
        b: "애니 데이터는 AniList에서 가져옵니다. 시즌과 에피소드 구조가 추측이 아니라 실제 값입니다.",
      },
      {
        t: "에피소드 단위 진행 기록.",
        b: "본 에피소드를 하나씩 체크하고 시즌에서 어디까지 봤는지 확인할 수 있습니다. TV Time에서 익숙했던 방식 그대로입니다.",
      },
      {
        t: "평점을 반영한 추천.",
        b: "For You 영역은 내 기록을 읽고 다음에 볼 것을 제안합니다. 모든 방문자에게 같은 인기 목록을 보여주지 않습니다.",
      },
      {
        t: "보여줄 수 있는 연말 결산.",
        b: "Golden Ticket 회원에게는 시청 시간과 주요 장르, 최고 평점 작품을 담은 연말 결산을 제공합니다.",
      },
    ],
  },
  section4: {
    title: "다른 대안 서비스와 비교하면",
    items: [
      {
        n: "Trakt",
        b: "오래 운영된 기록 서비스로 미디어 서버 연동과 API가 강합니다. 이미 Plex나 Kodi로 관리하시는 분에게 잘 맞고, 일부 기능은 유료 VIP 등급에 있습니다.",
      },
      {
        n: "Simkl",
        b: "TV Time의 모바일 사용감과 가장 비슷하고 스트리밍 서비스의 자동 기록을 지원합니다. 7월에 사용자가 몰리면서 서버가 버거워했습니다.",
      },
      {
        n: "Serializd",
        b: "레터박스 스타일의 티비 전용 서비스로 리뷰와 피드가 중심입니다. 티비만 다루기 때문에 영화와 애니는 다른 곳에 두게 됩니다.",
      },
      {
        n: "Bingers",
        b: "TV Time을 만든 개발자가 직접 만들었고, 그래서 커뮤니티가 많이 옮겨 갔습니다. 댓글 영역이 예전 에피소드 게시판과 가장 비슷합니다.",
      },
    ],
    note: "Seriez는 세 가지 종류를 모두 똑같이 다루는 곳이며, 이 목록에서 애니를 영화·티비 데이터베이스가 아니라 AniList에서 가져오는 유일한 서비스입니다.",
  },
  faq: {
    title: "자주 묻는 질문",
    items: [
      {
        q: "무료인가요?",
        a: "네. 계정 생성과 시청 기록, 평점, 리뷰, TV Time 기록 가져오기가 모두 무료입니다. Golden Ticket은 컬렉션 무제한과 리스트 공개 같은 부가 기능을 위한 선택형 유료 등급입니다.",
      },
      {
        q: "앱을 설치해야 하나요?",
        a: "아니요. 브라우저에서 바로 쓰시고, 휴대폰 홈 화면에 추가하면 앱처럼 열립니다. 앱스토어에서 받을 것은 없습니다.",
      },
      {
        q: "어떤 TV Time 파일이 필요한가요?",
        a: "TV Time 데이터 내보내기에서 받은 CSV 파일입니다. TV Time은 tracking-prod-records-v2.csv(티비·에피소드)와 tracking-prod-records.csv(영화) 두 개를 보냈습니다. 설정에서 차례로 가져오시면 됩니다.",
      },
      {
        q: "Trakt나 IMDb, 레터박스에서도 가져올 수 있나요?",
        a: "지금은 안 됩니다. 현재 지원하는 가져오기는 TV Time CSV뿐입니다.",
      },
      {
        q: "TV Time에 남긴 댓글과 반응은 어떻게 되나요?",
        a: "앱과 함께 삭제되었습니다. TV Time은 댓글이나 GIF 반응, 에피소드 게시판을 내보내지 않았기 때문에 어떤 서비스도 되살릴 수 없습니다. 평점과 시청 기록, 즐겨찾기가 옮겨지는 부분입니다.",
      },
      {
        q: "애니도 기록되나요?",
        a: "네. 애니 데이터는 AniList에서 가져오므로 시즌과 에피소드 수가 추측이 아니라 정확합니다. 영화, 티비와 같은 라이브러리에 함께 있습니다.",
      },
    ],
  },
  final: {
    title: "이미 가지고 있는 파일로 시작하세요",
    body: "계정을 만들고 내보낸 파일을 가져오면 몇 분 만에 라이브러리가 돌아옵니다. TV Time에서 데이터를 받지 못하셨다면 빈 상태로 시작하셔도 기록 방식은 같습니다.",
    cta: "무료로 계정 만들기",
    other: "레터박스 비교 보기",
  },
};

const koLb: LandingCopy = {
  meta: {
    title: "티비와 애니까지 되는 레터박스 대안",
    description:
      "레터박스는 영화만 다룹니다. Seriez는 영화, 티비, 애니를 한 라이브러리에서 기록하며 에피소드 진행, 평점, 리뷰, 컬렉션, 연말 결산을 제공합니다.",
  },
  eyebrow: "레터박스 대안",
  h1: "레터박스는 좋은데, 보는 것이 영화만은 아니신가요?",
  lead: "레터박스는 영화만 다루도록 만들어졌습니다. 그래서 여섯 시즌째 보는 드라마는 다른 앱에, 애니는 또 다른 앱에, 영화는 여기에 흩어집니다. Seriez는 세 가지를 한 라이브러리에 모으고, 이미 몸에 익은 기록 습관은 그대로 두고, 드라마에는 에피소드 진행 기록을 더합니다.",
  ctaPrimary: "무료로 계정 만들기",
  ctaSecondary: "TV Time에서 오시는 경우",
  ctaOther: "먼저 둘러보기",
  section1: {
    title: "보는 모든 것을 한 라이브러리에",
    items: [
      {
        t: "영화는 영화대로 제대로",
        b: "본 영화에 평점을 남기고 리뷰를 쓰고, 즐겨찾기를 표시하고 컬렉션을 만들 수 있습니다. 포스터와 출연진, 상영 시간 정보는 레터박스와 같은 TMDB에서 가져옵니다.",
      },
      {
        t: "드라마는 에피소드 단위까지",
        b: "작품을 팔로우하고 에피소드를 하나씩 체크하면서 시즌별 진행 상황을 확인할 수 있습니다. 새 시즌이 시작되면 피드에 올라오므로 방영일을 따로 찾지 않아도 됩니다.",
      },
      {
        t: "애니는 AniList 기준으로",
        b: "애니는 영화 데이터베이스로 표현할 수 없는 시즌·에피소드 구조를 가지고 있습니다. Seriez는 AniList에서 애니를 읽어오기 때문에 분할 방영이 중복 작품이나 잘못된 에피소드 수로 처리되지 않습니다.",
      },
      {
        t: "기록을 반영한 추천",
        b: "For You 영역은 세 가지 종류를 통틀어 내가 평가하고 끝까지 본 작품을 바탕으로 만들어집니다. 모든 방문자에게 같은 목록을 보여주지 않습니다.",
      },
    ],
  },
  section2: {
    title: "레터박스가 여전히 더 나은 부분",
    body: "솔직하게 말씀드리는 편이 시간을 아껴드립니다. 레터박스에는 15년에 걸쳐 만들어진 영화 글쓰기 문화와 커뮤니티가 있습니다. 리뷰는 에세이에 가깝고, 리스트는 그 자체로 하나의 장르이며, 연말 통계는 사람들이 기다리는 콘텐츠입니다. Seriez는 더 작고 새롭습니다. 영화 비평과 리스트 만들기가 이 서비스를 찾는 이유라면 그 부분은 레터박스가 여전히 더 나은 자리이고, 실제로 두 곳을 함께 쓰시는 분도 많습니다.",
    body2:
      "레터박스가 의도적으로 다루지 않는 것이 티비와 애니입니다. Seriez는 그 빈자리를 채웁니다. 영화 일기와 다섯 개의 드라마, 그리고 이번 시즌 애니를 함께 보신다면 라이브러리 세 개보다 하나가 낫습니다.",
  },
  section4: {
    title: "한눈에 비교",
    items: [
      {
        n: "영화",
        b: "둘 다 가능합니다. 영화 커뮤니티는 레터박스가 더 깊습니다. Seriez는 같은 기록 기능을 제공하면서 다른 시청 기록 옆에 나란히 둡니다.",
      },
      {
        n: "에피소드 진행이 있는 티비",
        b: "Seriez만 가능합니다. 레터박스는 영화만 다루기 때문에 에피소드 기록 기능이 없습니다.",
      },
      { n: "애니", b: "Seriez만 가능하며, AniList의 실제 시즌·에피소드 구조를 사용합니다." },
      {
        n: "연말 결산",
        b: "둘 다 있습니다. 이곳에서는 영화뿐 아니라 티비와 애니까지 한 번에 담을 수 있습니다.",
      },
      {
        n: "기존 기록 가져오기",
        b: "레터박스 가져오기는 아직 없습니다. TV Time에서 오시는 경우 CSV 가져오기는 지원합니다.",
      },
    ],
    note: "",
  },
  faq: {
    title: "자주 묻는 질문",
    items: [
      {
        q: "레터박스를 완전히 대체할 수 있나요?",
        a: "기록과 평점은 대체할 수 있습니다. 영화에 대해서도 같은 기능을 제공합니다. 다만 레터박스의 영화 글쓰기 문화와 오래 쌓인 리스트, 커뮤니티 규모는 Seriez에 없습니다. 두 곳을 함께 쓰시는 분도 많고, 그 편이 합리적입니다.",
      },
      {
        q: "티비 에피소드도 기록되나요?",
        a: "네. 본 에피소드를 하나씩 체크하고 작품마다 시즌에서 어디까지 봤는지 확인할 수 있습니다. 레터박스는 영화만 다루기 때문에 이 기능이 없습니다.",
      },
      {
        q: "애니 기록은 어떻게 되나요?",
        a: "AniList에서 가져오므로 시즌과 에피소드 수, 특별편이 실제 구조를 따릅니다. 영화·티비 데이터베이스에서 추정하지 않습니다. 애니는 영화, 드라마와 같은 라이브러리에 있습니다.",
      },
      {
        q: "레터박스 기록을 가져올 수 있나요?",
        a: "지금은 안 됩니다. 현재 지원하는 가져오기는 TV Time CSV뿐이라 레터박스의 영화는 직접 다시 추가하셔야 합니다.",
      },
      {
        q: "무료인가요?",
        a: "네. 계정과 기록, 평점, 리뷰, 댓글이 무료입니다. Golden Ticket은 컬렉션 무제한과 리스트 공개, 연말 결산 같은 부가 기능을 위한 선택형 유료 등급입니다.",
      },
    ],
  },
  final: {
    title: "기록 습관을 한 곳으로 모으세요",
    body: "어젯밤 본 영화에 평점을 남기고, 오늘 볼 에피소드를 체크하고, 세 화까지 본 애니 시즌을 추가하시면 됩니다. 라이브러리 하나, 연말 결산 하나로 정리됩니다.",
    cta: "무료로 계정 만들기",
    other: "먼저 둘러보기",
  },
};

const esTv: LandingCopy = {
  meta: {
    title: "Alternativa a TV Time: conserva tu historial",
    description:
      "TV Time cerró el 15 de julio de 2026. Pasa tu historial a Seriez importando el CSV de tu exportación y sigue registrando películas, series y anime en un solo lugar.",
  },
  eyebrow: "ALTERNATIVA A TV TIME",
  h1: "TV Time se fue. Tu historial no tiene por qué irse con él.",
  lead: "TV Time cerró el 15 de julio de 2026 y se llevó trece años de episodios marcados, puntuaciones y listas. Si alcanzaste a descargar tus datos, puedes traerlos a Seriez en unos minutos: importa el archivo, conserva tu historial y sigue registrando películas, series y anime en una sola biblioteca.",
  ctaPrimary: "Crear una cuenta gratis",
  ctaSecondary: "Ir a Importar CSV",
  ctaOther: "¿También ves películas? Compara con Letterboxd",
  section1: {
    title: "Trae tu historial de TV Time",
    lead: "La importación acepta el archivo tal como salió de TV Time. Sin reformatear nada y sin herramientas externas.",
    items: [
      {
        t: "Busca el CSV que descargaste",
        b: "TV Time envió dos archivos: tracking-prod-records-v2.csv para series y episodios, y tracking-prod-records.csv para películas. Si no alcanzaste a descargarlos, esos archivos ya no existen, pero puedes empezar una biblioteca nueva aquí.",
      },
      {
        t: "Crea tu cuenta de Seriez",
        b: "Es gratis y no hay nada que bajar de una tienda de aplicaciones. En el móvil puedes añadir Seriez a la pantalla de inicio para que se abra como una app.",
      },
      {
        t: "Suelta el archivo en Ajustes",
        b: "Ajustes, luego Datos, luego Importar CSV. Tus episodios vistos, puntuaciones y favoritos llegan a tu biblioteca, y las barras de progreso continúan donde TV Time las dejó.",
      },
    ],
  },
  section2: {
    title: "Lo que viaja y lo que no",
    cols: [
      {
        title: "Viene contigo",
        items: [
          "Todos los episodios que marcaste como vistos",
          "Las series que tenías a medias",
          "Las películas que registraste",
          "Tus puntuaciones y favoritos",
        ],
      },
      {
        title: "No puede venir contigo",
        items: ["Comentarios y reacciones por episodio", "Hilos de GIF y publicaciones de la comunidad", "Seguidores y tu perfil anterior"],
      },
    ],
    note:
      "TV Time nunca exportó eso y sus servidores ya no existen, así que ningún servicio puede recuperarlo. Lo que sí puedes hacer aquí es volver a empezar las conversaciones: cada título tiene su sección de reseñas y tus puntuaciones alimentan los descubrimientos de los demás.",
  },
  section3: {
    title: "Por qué la gente se está mudando aquí",
    items: [
      {
        t: "Películas, series y anime en una biblioteca.",
        b: "Letterboxd cubre solo cine. Seriez mantiene los tres juntos, así dejas de mantener dos o tres listas por separado.",
      },
      {
        t: "Anime que por fin está bien.",
        b: "Los datos de anime vienen de AniList, así que la estructura de temporadas y episodios es real y no una aproximación de una base de datos de televisión.",
      },
      {
        t: "Progreso episodio por episodio.",
        b: "Marca los episodios que ves y mira en qué punto de la temporada vas, la misma costumbre que te dejó TV Time.",
      },
      {
        t: "Descubrimiento basado en tus puntuaciones.",
        b: "La sección For You lee tu historial y sugiere qué ver después en lugar de mostrar la misma lista popular a todo el mundo.",
      },
      {
        t: "Un resumen del año para presumir.",
        b: "Los miembros de Golden Ticket reciben un resumen anual con horas vistas, géneros principales y tus títulos mejor puntuados.",
      },
    ],
  },
  section4: {
    title: "Dónde encaja Seriez entre las alternativas",
    items: [
      {
        n: "Trakt",
        b: "Un registro veterano con integraciones profundas de servidores multimedia y una API potente. Ideal si ya usas Plex o Kodi, con algunas funciones dentro del plan VIP de pago.",
      },
      {
        n: "Simkl",
        b: "Lo más parecido a la sensación móvil de TV Time, con registro automático desde los servicios de streaming. Sus servidores sufrieron con la llegada masiva de julio.",
      },
      {
        n: "Serializd",
        b: "Un hogar estilo Letterboxd para televisión, centrado en reseñas y un feed cuidado. Solo televisión, así que tus películas y tu anime viven en otro sitio.",
      },
      {
        n: "Bingers",
        b: "Lo creó el desarrollador detrás de TV Time, y por eso gran parte de la comunidad terminó allí. Sus comentarios son lo más cercano a los antiguos hilos por episodio.",
      },
    ],
    note: "Seriez es el único que trata los tres tipos de contenido de igual forma, y el único de esta lista donde el anime viene de AniList y no de una base de datos de cine y televisión.",
  },
  faq: {
    title: "Lo que la gente pregunta primero",
    items: [
      {
        q: "¿Seriez es gratis?",
        a: "Sí. Crear la cuenta, registrar lo que ves, puntuar, escribir reseñas e importar tu historial de TV Time son gratis. Golden Ticket es un plan de pago opcional para extras como colecciones ilimitadas y listas publicadas.",
      },
      {
        q: "¿Tengo que instalar una app?",
        a: "No. Seriez funciona en el navegador y puedes añadirlo a la pantalla de inicio del móvil para que se abra como una app. No hay nada que descargar de una tienda.",
      },
      {
        q: "¿Qué archivo de TV Time necesito?",
        a: "Los CSV de tu exportación de datos de TV Time. Fueron dos: tracking-prod-records-v2.csv para series y episodios, y tracking-prod-records.csv para películas. Impórtalos uno tras otro desde Ajustes.",
      },
      {
        q: "¿También puedo importar desde Trakt, IMDb o Letterboxd?",
        a: "Hoy no. La importación de CSV de TV Time es la única que Seriez admite por ahora.",
      },
      {
        q: "¿Qué pasó con mis comentarios y reacciones de TV Time?",
        a: "Se borraron con la aplicación. TV Time nunca exportó comentarios, reacciones con GIF ni los hilos de la comunidad, así que ningún servicio puede recuperarlos. Lo que sí viaja son las puntuaciones, el historial y los favoritos.",
      },
      {
        q: "¿Seriez también registra anime?",
        a: "Sí. Los datos vienen de AniList, así que las temporadas y el número de episodios son correctos y no una suposición, y el anime convive con tus películas y series.",
      },
    ],
  },
  final: {
    title: "Empieza con el archivo que ya tienes",
    body: "Crea una cuenta, importa tu exportación y tu biblioteca estará de vuelta en unos minutos. Si nunca pudiste sacar tus datos de TV Time, empieza vacío: el registro funciona igual.",
    cta: "Crear una cuenta gratis",
    other: "Ver la comparación con Letterboxd",
  },
};

const esLb: LandingCopy = {
  meta: {
    title: "Alternativa a Letterboxd con series y anime",
    description:
      "Letterboxd es solo cine. Seriez registra películas, series y anime en una sola biblioteca, con progreso por episodio, puntuaciones, reseñas, colecciones y resumen anual.",
  },
  eyebrow: "ALTERNATIVA A LETTERBOXD",
  h1: "¿Te gusta Letterboxd, pero no ves solo películas?",
  lead: "Letterboxd es cine por decisión propia. Así que la serie en la que vas por la sexta temporada vive en una app, el anime en otra y las películas aquí. Seriez reúne los tres en una biblioteca, mantiene la costumbre del diario que ya tienes y añade progreso por episodio en las series.",
  ctaPrimary: "Crear una cuenta gratis",
  ctaSecondary: "Vengo de TV Time",
  ctaOther: "Echar un vistazo primero",
  section1: {
    title: "Una biblioteca para todo lo que ves",
    items: [
      {
        t: "Películas, con lo que importa",
        b: "Puntúa lo que terminas, escribe una reseña, marca favoritos y arma colecciones. Carteles, reparto y duración vienen de TMDB, la misma fuente que usa Letterboxd para sus datos de cine.",
      },
      {
        t: "Series, episodio por episodio",
        b: "Sigue tus series, marca los episodios que ves y mira tu progreso por temporada. Cuando empieza una temporada nueva aparece en tu feed, sin tener que buscar fechas de estreno.",
      },
      {
        t: "Anime, desde AniList",
        b: "El anime tiene su propia estructura de temporadas y episodios que una base de datos de cine no puede expresar. Seriez lee el anime de AniList, así que un split cour no se convierte en un duplicado ni en un número de episodios equivocado.",
      },
      {
        t: "Recomendaciones con tu historial",
        b: "La sección For You se construye con lo que puntuaste y terminaste, en los tres tipos de contenido, en lugar de dar el mismo listado a todos los visitantes.",
      },
    ],
  },
  section2: {
    title: "Dónde Letterboxd sigue siendo mejor",
    body: "Ser honesto con esto te ahorra tiempo. Letterboxd tiene una cultura de escritura sobre cine y una comunidad que tardó quince años en construirse: las reseñas son ensayos, las listas son un género propio y las estadísticas anuales son algo que la gente espera. Seriez es más pequeño y más nuevo. Si la crítica de cine y hacer listas son tu razón para entrar, Letterboxd sigue siendo el mejor sitio para eso, y aquí mucha gente mantiene las dos cuentas.",
    body2:
      "Lo que Letterboxd deliberadamente no hace es televisión y anime. Ese hueco es el que llena Seriez. Si tu costumbre es un diario de cine más cinco series más el anime de la temporada, una biblioteca gana a tres.",
  },
  section4: {
    title: "Comparación directa y sin rodeos",
    items: [
      {
        n: "Películas",
        b: "Los dos. Letterboxd tiene la comunidad cinematográfica más profunda. Seriez tiene lo básico del registro y lo pone junto al resto de lo que ves.",
      },
      {
        n: "Series con progreso por episodio",
        b: "Solo Seriez. Letterboxd cubre exclusivamente cine, por eso el seguimiento de episodios no existe allí.",
      },
      { n: "Anime", b: "Solo Seriez, con datos de AniList y estructura real de temporadas y episodios." },
      {
        n: "Resumen anual",
        b: "Los dos lo ofrecen. El de aquí puede abarcar películas, series y anime en un solo resumen en lugar de solo cine.",
      },
      {
        n: "Importar tu historial",
        b: "La importación desde Letterboxd aún no existe. La de CSV de TV Time sí, si vienes de allí.",
      },
    ],
    note: "",
  },
  faq: {
    title: "Lo que la gente pregunta primero",
    items: [
      {
        q: "¿Seriez sustituye por completo a Letterboxd?",
        a: "Para registrar y puntuar, sí: las películas reciben el mismo trato aquí. Lo que Seriez no tiene es la cultura de escritura sobre cine de Letterboxd, sus listas de años y el tamaño de su comunidad. Bastante gente mantiene las dos cuentas y es una decisión razonable.",
      },
      {
        q: "¿Seriez registra episodios de series?",
        a: "Sí. Marcas los episodios que ves y cada serie muestra en qué punto de la temporada vas. Letterboxd no lo hace porque solo cubre cine.",
      },
      {
        q: "¿Cómo funciona el registro de anime?",
        a: "El anime viene de AniList, así que temporadas, número de episodios y especiales siguen la estructura real en lugar de una aproximación de una base de datos de cine y televisión. El anime comparte biblioteca con tus películas y series.",
      },
      {
        q: "¿Puedo importar mi historial de Letterboxd?",
        a: "Hoy no. La importación de CSV de TV Time es la única que Seriez admite por ahora, así que tus películas de Letterboxd habría que añadirlas a mano.",
      },
      {
        q: "¿Es gratis?",
        a: "Sí. Cuenta, registro, puntuaciones, reseñas y comentarios son gratis. Golden Ticket es un plan de pago opcional para extras como colecciones ilimitadas, listas publicadas y el resumen anual.",
      },
    ],
  },
  final: {
    title: "Lleva toda la costumbre a un solo lugar",
    body: "Puntúa la película que viste anoche, marca el episodio de hoy y añade la temporada de anime en la que vas por el tercer episodio. Una biblioteca y un solo resumen a final de año.",
    cta: "Crear una cuenta gratis",
    other: "Echar un vistazo primero",
  },
};

const ptTv: LandingCopy = {
  meta: {
    title: "Alternativa ao TV Time: mantenha seu histórico",
    description:
      "O TV Time encerrou em 15 de julho de 2026. Traga seu histórico para o Seriez importando o CSV da sua exportação e acompanhe filmes, séries e animes em um só lugar.",
  },
  eyebrow: "ALTERNATIVA AO TV TIME",
  h1: "O TV Time acabou. Seu histórico não precisa acabar junto.",
  lead: "O TV Time encerrou em 15 de julho de 2026 e levou treze anos de episódios marcados, notas e listas. Se você conseguiu baixar seus dados, pode trazê-los para o Seriez em poucos minutos: importe o arquivo, mantenha o histórico e siga registrando filmes, séries e animes em uma única biblioteca.",
  ctaPrimary: "Criar uma conta grátis",
  ctaSecondary: "Ir para Importar CSV",
  ctaOther: "Também assiste filmes? Veja a comparação com o Letterboxd",
  section1: {
    title: "Traga seu histórico do TV Time",
    lead: "A importação aceita o arquivo exatamente como saiu do TV Time. Sem reformatar nada e sem ferramentas de terceiros.",
    items: [
      {
        t: "Encontre o CSV que você baixou",
        b: "O TV Time enviou dois arquivos: tracking-prod-records-v2.csv para séries e episódios, e tracking-prod-records.csv para filmes. Se você perdeu a janela de download, esses arquivos não existem mais, mas você ainda pode começar uma biblioteca nova aqui.",
      },
      {
        t: "Crie sua conta no Seriez",
        b: "É grátis e não há nada para baixar de loja de aplicativos. No celular você pode adicionar o Seriez à tela inicial para abrir como um app.",
      },
      {
        t: "Solte o arquivo em Ajustes",
        b: "Ajustes, depois Dados, depois Importar CSV. Seus episódios assistidos, notas e favoritos chegam à sua biblioteca, e as barras de progresso continuam de onde o TV Time parou.",
      },
    ],
  },
  section2: {
    title: "O que vem e o que não vem",
    cols: [
      {
        title: "Vem com você",
        items: ["Todos os episódios que você marcou como assistidos", "Séries que você estava acompanhando", "Filmes que você registrou", "Suas notas e favoritos"],
      },
      {
        title: "Não pode vir",
        items: ["Comentários e reações por episódio", "Tópicos com GIF e publicações da comunidade", "Seguidores e seu perfil antigo"],
      },
    ],
    note:
      "O TV Time nunca exportou isso e os servidores não existem mais, então nenhum serviço consegue recuperar. O que você pode fazer aqui é recomeçar as conversas: todo título tem uma área de resenhas e suas notas alimentam o descobrimento dos outros.",
  },
  section3: {
    title: "Por que as pessoas estão vindo para cá",
    items: [
      {
        t: "Filmes, séries e animes em uma biblioteca.",
        b: "O Letterboxd cobre apenas cinema. O Seriez mantém os três juntos, então você deixa de manter duas ou três listas separadas.",
      },
      {
        t: "Anime que finalmente está certo.",
        b: "Os dados de anime vêm do AniList, então a estrutura de temporadas e episódios é real, não uma aproximação de um banco de dados de TV.",
      },
      {
        t: "Progresso episódio por episódio.",
        b: "Marque os episódios conforme assiste e veja em que ponto da temporada está, o mesmo hábito que o TV Time criou.",
      },
      {
        t: "Descobertas a partir das suas notas.",
        b: "A seção For You lê seu histórico e sugere o que assistir depois, em vez de mostrar a mesma lista popular para todo mundo.",
      },
      {
        t: "Um resumo do ano para mostrar.",
        b: "Assinantes do Golden Ticket recebem um resumo anual com horas assistidas, gêneros principais e seus títulos mais bem avaliados.",
      },
    ],
  },
  section4: {
    title: "Onde o Seriez se encaixa entre as alternativas",
    items: [
      {
        n: "Trakt",
        b: "Um registro veterano com integrações profundas de servidores de mídia e uma API forte. Ideal se você já usa Plex ou Kodi, com algumas funções no plano VIP pago.",
      },
      {
        n: "Simkl",
        b: "O mais parecido com a sensação mobile do TV Time, com registro automático pelos serviços de streaming. Os servidores sofreram com a chegada em massa em julho.",
      },
      {
        n: "Serializd",
        b: "Um lar no estilo Letterboxd para televisão, feito de resenhas e um feed limpo. Só televisão, então seus filmes e animes ficam em outro lugar.",
      },
      {
        n: "Bingers",
        b: "Foi criado pelo desenvolvedor por trás do TV Time, e por isso boa parte da comunidade foi para lá. Os comentários são o mais próximo dos antigos tópicos por episódio.",
      },
    ],
    note: "O Seriez é o único que trata os três tipos de conteúdo como iguais, e o único desta lista em que o anime vem do AniList e não de um banco de dados de cinema e TV.",
  },
  faq: {
    title: "Perguntas que aparecem primeiro",
    items: [
      {
        q: "O Seriez é grátis?",
        a: "Sim. Criar conta, registrar o que você assiste, dar notas, escrever resenhas e importar seu histórico do TV Time são gratuitos. O Golden Ticket é um plano pago opcional para extras como coleções ilimitadas e listas publicadas.",
      },
      {
        q: "Preciso instalar um aplicativo?",
        a: "Não. O Seriez funciona no navegador e você pode adicioná-lo à tela inicial do celular para abrir como um app. Não há nada para baixar de uma loja.",
      },
      {
        q: "Qual arquivo do TV Time eu preciso?",
        a: "Os CSV da sua exportação de dados do TV Time. Foram dois: tracking-prod-records-v2.csv para séries e episódios, e tracking-prod-records.csv para filmes. Importe um depois do outro em Ajustes.",
      },
      {
        q: "Também posso importar do Trakt, IMDb ou Letterboxd?",
        a: "Hoje não. A importação de CSV do TV Time é a única que o Seriez aceita no momento.",
      },
      {
        q: "O que aconteceu com meus comentários e reações do TV Time?",
        a: "Foram apagados com o aplicativo. O TV Time nunca exportou comentários, reações com GIF nem os tópicos da comunidade, então nenhum serviço consegue trazê-los de volta. Notas, histórico e favoritos são o que viaja.",
      },
      {
        q: "O Seriez também registra animes?",
        a: "Sim. Os dados vêm do AniList, então temporadas e contagem de episódios são corretas em vez de suposição, e os animes ficam na mesma biblioteca dos seus filmes e séries.",
      },
    ],
  },
  final: {
    title: "Comece com o arquivo que você já tem",
    body: "Crie uma conta, importe sua exportação e sua biblioteca volta em poucos minutos. Se você nunca conseguiu tirar seus dados do TV Time, comece vazio: o registro funciona do mesmo jeito.",
    cta: "Criar uma conta grátis",
    other: "Ver a comparação com o Letterboxd",
  },
};

const ptLb: LandingCopy = {
  meta: {
    title: "Alternativa ao Letterboxd com séries e animes",
    description:
      "O Letterboxd é só cinema. O Seriez registra filmes, séries e animes em uma biblioteca, com progresso por episódio, notas, resenhas, coleções e resumo anual.",
  },
  eyebrow: "ALTERNATIVA AO LETTERBOXD",
  h1: "Gosta do Letterboxd, mas não assiste só filmes?",
  lead: "O Letterboxd é cinema por decisão própria. Então a série em que você está na sexta temporada fica em um app, o anime em outro e os filmes aqui. O Seriez junta os três em uma biblioteca, mantém o hábito do diário que você já tem e acrescenta progresso por episódio nas séries.",
  ctaPrimary: "Criar uma conta grátis",
  ctaSecondary: "Venho do TV Time",
  ctaOther: "Dar uma olhada primeiro",
  section1: {
    title: "Uma biblioteca para tudo o que você assiste",
    items: [
      {
        t: "Filmes, com o que importa",
        b: "Dê nota ao que termina, escreva uma resenha, marque favoritos e monte coleções. Pôsteres, elenco e duração vêm do TMDB, a mesma fonte que o Letterboxd usa para dados de cinema.",
      },
      {
        t: "Séries, episódio por episódio",
        b: "Siga suas séries, marque os episódios conforme assiste e veja seu progresso por temporada. Quando uma temporada nova estreia, ela aparece no seu feed, sem você precisar procurar datas.",
      },
      {
        t: "Anime, do AniList",
        b: "O anime tem sua própria estrutura de temporadas e episódios, que um banco de dados de cinema não consegue expressar. O Seriez lê anime do AniList, então um split cour não vira duplicata nem contagem errada de episódios.",
      },
      {
        t: "Recomendações com seu histórico",
        b: "A seção For You é construída com o que você avaliou e terminou, nos três tipos de conteúdo, em vez de entregar a mesma lista a todos os visitantes.",
      },
    ],
  },
  section2: {
    title: "Onde o Letterboxd ainda é melhor",
    body: "Ser honesto aqui economiza seu tempo. O Letterboxd tem uma cultura de escrita sobre cinema e uma comunidade que levou quinze anos para se formar: as resenhas são ensaios, as listas são um gênero à parte e as estatísticas anuais são algo que as pessoas esperam. O Seriez é menor e mais novo. Se crítica de cinema e listas são o motivo de você entrar, o Letterboxd continua sendo o melhor lugar para isso, e aqui muita gente mantém as duas contas.",
    body2:
      "O que o Letterboxd deliberadamente não faz é televisão e anime. Essa lacuna é o que o Seriez preenche. Se o seu hábito é diário de cinema mais cinco séries mais o anime da temporada, uma biblioteca vale mais que três.",
  },
  section4: {
    title: "Comparação direta, sem rodeios",
    items: [
      {
        n: "Filmes",
        b: "Os dois. O Letterboxd tem a comunidade de cinema mais profunda. O Seriez tem o básico do registro e coloca isso ao lado de tudo o que você assiste.",
      },
      {
        n: "Séries com progresso por episódio",
        b: "Só o Seriez. O Letterboxd cobre exclusivamente cinema, por isso o acompanhamento de episódios não existe lá.",
      },
      { n: "Anime", b: "Só o Seriez, com dados do AniList e estrutura real de temporadas e episódios." },
      {
        n: "Resumo anual",
        b: "Os dois oferecem. O daqui pode incluir filmes, séries e animes em um único resumo, em vez de só cinema.",
      },
      {
        n: "Importar seu histórico",
        b: "A importação do Letterboxd ainda não existe. A de CSV do TV Time sim, se você vem de lá.",
      },
    ],
    note: "",
  },
  faq: {
    title: "Perguntas que aparecem primeiro",
    items: [
      {
        q: "O Seriez substitui o Letterboxd por completo?",
        a: "Para registrar e dar notas, sim: filmes recebem o mesmo tratamento aqui. O que o Seriez não tem é a cultura de escrita sobre cinema do Letterboxd, suas listas de anos e o tamanho da comunidade. Muita gente mantém as duas contas, e é uma escolha razoável.",
      },
      {
        q: "O Seriez registra episódios de séries?",
        a: "Sim. Você marca os episódios conforme assiste e cada série mostra em que ponto da temporada você está. O Letterboxd não faz isso porque cobre apenas cinema.",
      },
      {
        q: "Como funciona o registro de anime?",
        a: "O anime vem do AniList, então temporadas, contagem de episódios e especiais seguem a estrutura real em vez de uma aproximação de um banco de dados de cinema e TV. O anime divide a biblioteca com seus filmes e séries.",
      },
      {
        q: "Posso importar meu histórico do Letterboxd?",
        a: "Hoje não. A importação de CSV do TV Time é a única que o Seriez aceita no momento, então seus filmes do Letterboxd precisariam ser adicionados à mão.",
      },
      {
        q: "É grátis?",
        a: "Sim. Conta, registro, notas, resenhas e comentários são gratuitos. O Golden Ticket é um plano pago opcional para extras como coleções ilimitadas, listas publicadas e o resumo anual.",
      },
    ],
  },
  final: {
    title: "Leve o hábito inteiro para um só lugar",
    body: "Dê nota ao filme que você viu ontem, marque o episódio de hoje e adicione a temporada de anime em que você está no terceiro episódio. Uma biblioteca e um único resumo no fim do ano.",
    cta: "Criar uma conta grátis",
    other: "Dar uma olhada primeiro",
  },
};

const jaTv: LandingCopy = {
  meta: {
    title: "TV Timeの代替: 視聴記録をそのまま引き継ぐ",
    description:
      "TV Timeは2026年7月15日に終了しました。書き出したCSVを取り込めば、視聴記録をSeriezに引き継ぎ、映画・ドラマ・アニメをひとつの場所で記録できます。",
  },
  eyebrow: "TV TIMEの代替",
  h1: "TV Timeは終了しました。視聴記録まで失う必要はありません。",
  lead: "TV Timeは2026年7月15日にサービスを終了し、13年分の視聴チェック、評価、リストを共に消しました。データを書き出しておいた方は、数分でSeriezに引き継げます。ファイルを取り込み、記録はそのままに、これからは映画・ドラマ・アニメをひとつのライブラリで管理できます。",
  ctaPrimary: "無料でアカウントを作成",
  ctaSecondary: "CSVインポートへ",
  ctaOther: "映画も記録していますか？Letterboxdとの比較を見る",
  section1: {
    title: "TV Timeの視聴記録を引き継ぐ",
    lead: "TV Timeから出したファイルをそのまま取り込みます。形式の変換も、外部ツールも必要ありません。",
    items: [
      {
        t: "書き出したCSVを探す",
        b: "TV Timeから届いたファイルは2つです。ドラマとエピソードは tracking-prod-records-v2.csv、映画は tracking-prod-records.csv です。書き出し期間を逃していた場合、ファイルはもう手に入りませんが、ここで新しく始めることはできます。",
      },
      {
        t: "Seriezのアカウントを作成",
        b: "無料で、アプリストアからのダウンロードも不要です。スマートフォンではホーム画面に追加すると、アプリのように開きます。",
      },
      {
        t: "設定でファイルを取り込む",
        b: "設定、データ、CSVインポートの順に進み、ファイルを入れてください。視聴済みのエピソード、評価、お気に入りがライブラリに入り、視聴中の作品の進捗はTV Timeが止まった地点から続きます。",
      },
    ],
  },
  section2: {
    title: "引き継げるもの、引き継げないもの",
    cols: [
      {
        title: "そのまま引き継げます",
        items: ["視聴済みにしたすべてのエピソード", "途中まで見ていた作品", "記録していた映画", "評価とお気に入り"],
      },
      {
        title: "引き継げません",
        items: ["エピソードごとのコメントとリアクション", "GIF投稿とコミュニティのスレッド", "フォロワーと以前のプロフィール"],
      },
    ],
    note:
      "これらはTV Timeが書き出しておらず、サーバーも残っていないため、どのサービスでも復元できません。代わりにここで会話をやり直せます。すべての作品にレビュー欄があり、あなたの評価は他の人の発見につながります。",
  },
  section3: {
    title: "人がここに移ってくる理由",
    items: [
      {
        t: "映画もドラマもアニメも、ひとつのライブラリに。",
        b: "Letterboxdは映画だけを扱います。Seriezは3つを一緒に保つので、リストを2つも3つも管理する必要がなくなります。",
      },
      {
        t: "アニメの情報が正確。",
        b: "アニメのデータはAniListから取得します。シーズンとエピソードの構造が推測ではなく実際の値です。",
      },
      {
        t: "エピソード単位の進捗。",
        b: "見たエピソードを1話ずつチェックし、シーズンのどこまで進んだかを確認できます。TV Timeで身についた習慣そのままです。",
      },
      {
        t: "評価を反映したおすすめ。",
        b: "For Youはあなたの記録を読み、次に何を見るかを提案します。すべての訪問者に同じ人気リストを出すことはありません。",
      },
      {
        t: "見せられる年間まとめ。",
        b: "Golden Ticketの会員は、視聴時間、よく見たジャンル、高評価の作品をまとめた年間レポートを受け取れます。",
      },
    ],
  },
  section4: {
    title: "他のサービスと比べたときのSeriez",
    items: [
      {
        n: "Trakt",
        b: "長年使われている記録サービスで、メディアサーバーとの連携とAPIが強力です。すでにPlexやKodiで管理している人に向いており、一部の機能は有料のVIPに含まれます。",
      },
      {
        n: "Simkl",
        b: "TV Timeのアプリの感触に最も近く、配信サービスからの自動記録に対応しています。7月に利用者が集中してサーバーが苦しくなりました。",
      },
      {
        n: "Serializd",
        b: "Letterboxd風のテレビ専用サービスで、レビューとフィードが中心です。テレビだけなので、映画とアニメは別の場所に置くことになります。",
      },
      {
        n: "Bingers",
        b: "TV Timeを作った開発者が手がけたサービスで、コミュニティの多くがそこへ移りました。コメント欄はかつてのエピソード掲示板に最も近い存在です。",
      },
    ],
    note: "Seriezは3種類のコンテンツを同じ扱いにする唯一のサービスで、この中でアニメを映画・テレビのデータベースではなくAniListから取得しているのもSeriezだけです。",
  },
  faq: {
    title: "よくある質問",
    items: [
      {
        q: "無料ですか？",
        a: "はい。アカウント作成、視聴記録、評価、レビュー、TV Timeの記録の取り込みはすべて無料です。Golden Ticketは、コレクションの無制限やリスト公開などの追加機能のための任意の有料プランです。",
      },
      {
        q: "アプリを入れないといけませんか？",
        a: "いいえ。ブラウザで動きます。スマートフォンのホーム画面に追加すれば、アプリのように開きます。アプリストアから落とすものはありません。",
      },
      {
        q: "どのTV Timeのファイルが必要ですか？",
        a: "TV Timeのデータ書き出しで受け取ったCSVです。tracking-prod-records-v2.csv(ドラマとエピソード)と tracking-prod-records.csv(映画)の2つで、設定から順に取り込んでください。",
      },
      {
        q: "TraktやIMDb、Letterboxdからも取り込めますか？",
        a: "現在はできません。いま対応しているのはTV TimeのCSVのみです。",
      },
      {
        q: "TV Timeに書いたコメントやリアクションはどうなりましたか？",
        a: "アプリと一緒に削除されました。TV TimeはコメントやGIFのリアクション、コミュニティのスレッドを書き出していないため、どのサービスでも戻せません。引き継げるのは評価、視聴記録、お気に入りです。",
      },
      {
        q: "アニメも記録できますか？",
        a: "はい。アニメのデータはAniListから取得するため、シーズンとエピソード数が推測ではなく正確です。映画やドラマと同じライブラリに入ります。",
      },
    ],
  },
  final: {
    title: "手元にあるファイルから始めましょう",
    body: "アカウントを作り、書き出したファイルを取り込めば、数分でライブラリが戻ります。TV Timeからデータを取り出せなかった場合も、空の状態から始めれば記録の仕組みは同じです。",
    cta: "無料でアカウントを作成",
    other: "Letterboxdとの比較を見る",
  },
};

const jaLb: LandingCopy = {
  meta: {
    title: "ドラマとアニメも記録できるLetterboxdの代替",
    description:
      "Letterboxdは映画だけを扱います。Seriezは映画・ドラマ・アニメをひとつのライブラリで記録し、エピソード進捗、評価、レビュー、コレクション、年間まとめを提供します。",
  },
  eyebrow: "LETTERBOXDの代替",
  h1: "Letterboxdは好きだけど、見るのは映画だけではありませんか？",
  lead: "Letterboxdは映画専用として作られています。そのため、シーズン6まで見ているドラマは別のアプリ、アニメはまた別のアプリ、映画はここ、と記録が散らばります。Seriezは3つをひとつのライブラリにまとめ、すでに身についている記録の習慣はそのままに、ドラマにはエピソード単位の進捗を加えます。",
  ctaPrimary: "無料でアカウントを作成",
  ctaSecondary: "TV Timeから来た方はこちら",
  ctaOther: "まず中を見てみる",
  section1: {
    title: "見るものすべてをひとつのライブラリに",
    items: [
      {
        t: "映画は映画らしく",
        b: "見終えた作品に評価をつけ、レビューを書き、お気に入りを登録し、コレクションを作れます。ポスターや出演者、上映時間は、Letterboxdと同じTMDBから取得します。",
      },
      {
        t: "ドラマはエピソード単位まで",
        b: "作品をフォローし、見たエピソードを1話ずつチェックして、シーズンごとの進捗を確認できます。新しいシーズンが始まればフィードに届くので、配信日を探し回る必要はありません。",
      },
      {
        t: "アニメはAniListのデータで",
        b: "アニメには、映画のデータベースでは表現できないシーズンとエピソードの構造があります。SeriezはAniListからアニメを読むため、分割クールが重複作品や誤った話数になることはありません。",
      },
      {
        t: "記録を使ったおすすめ",
        b: "For Youは、3種類すべてを横断して、あなたが評価し見終えた作品から作られます。訪問者全員に同じリストを渡すことはありません。",
      },
    ],
  },
  section2: {
    title: "Letterboxdが今も優れている点",
    body: "ここを正直に話すほうが、あなたの時間を節約できます。Letterboxdには15年をかけて育った映画の文章文化とコミュニティがあります。レビューはエッセイのようで、リストはそれ自体がひとつのジャンルであり、年間統計は多くの人が待ち望むものです。Seriezはより小さく、新しいサービスです。映画批評とリスト作りが通う理由なら、その部分はLetterboxdが今も最良の場所であり、両方を使い続けている人も多くいます。",
    body2:
      "Letterboxdが意図的に扱わないのが、テレビとアニメです。その空きをSeriezが埋めます。映画の日記に加えてドラマを5本、さらに今季のアニメを見ているなら、ライブラリは3つより1つのほうが楽です。",
  },
  section4: {
    title: "単純に並べて比べる",
    items: [
      {
        n: "映画",
        b: "どちらも可能です。映画コミュニティの厚みはLetterboxdが上です。Seriezは同じ記録機能を、他の視聴記録の隣に置きます。",
      },
      {
        n: "エピソード進捗つきのドラマ",
        b: "Seriezのみです。Letterboxdは映画だけを扱うため、エピソード記録の機能がありません。",
      },
      { n: "アニメ", b: "Seriezのみで、AniListの実際のシーズンとエピソード構造を使います。" },
      {
        n: "年間まとめ",
        b: "どちらにもあります。ここでは映画だけでなく、ドラマとアニメもひとつのまとめに入ります。",
      },
      {
        n: "既存の記録の取り込み",
        b: "Letterboxdからの取り込みはまだありません。TV TimeからのCSV取り込みには対応しています。",
      },
    ],
    note: "",
  },
  faq: {
    title: "よくある質問",
    items: [
      {
        q: "Letterboxdを完全に置き換えられますか？",
        a: "記録と評価については置き換えられます。映画も同じように扱えます。ただしLetterboxdの映画についての文章文化、長年積み上がったリスト、コミュニティの規模はSeriezにはありません。両方を併用している人も多く、それは合理的な選択です。",
      },
      {
        q: "ドラマのエピソードも記録できますか？",
        a: "はい。見たエピソードを1話ずつチェックし、作品ごとにシーズンのどこまで進んだかを確認できます。Letterboxdは映画のみを扱うため、この機能はありません。",
      },
      {
        q: "アニメの記録はどうなっていますか？",
        a: "AniListから取得するため、シーズンや話数、特別編が実際の構造に従います。映画・テレビのデータベースからの推測ではありません。アニメは映画やドラマと同じライブラリに入ります。",
      },
      {
        q: "Letterboxdの記録を取り込めますか？",
        a: "現在はできません。対応しているのはTV TimeのCSVのみで、Letterboxdの映画は手で追加する必要があります。",
      },
      {
        q: "無料ですか？",
        a: "はい。アカウント、記録、評価、レビュー、コメントは無料です。Golden Ticketは、コレクションの無制限、リスト公開、年間まとめなどの追加機能のための任意の有料プランです。",
      },
    ],
  },
  final: {
    title: "記録の習慣をひとつにまとめる",
    body: "昨夜見た映画に評価をつけ、今夜のエピソードをチェックし、3話まで見たアニメのシーズンを追加する。ライブラリはひとつ、年末のまとめもひとつになります。",
    cta: "無料でアカウントを作成",
    other: "まず中を見てみる",
  },
};

const zhTv: LandingCopy = {
  meta: {
    title: "TV Time 替代方案：把观看记录带过来",
    description:
      "TV Time 已于 2026 年 7 月 15 日关闭。导入你导出的 CSV 文件，就能把观看记录搬到 Seriez，并在同一个地方记录电影、剧集和动画。",
  },
  eyebrow: "TV TIME 替代方案",
  h1: "TV Time 已经关闭，你的观看记录不必一起消失。",
  lead: "TV Time 于 2026 年 7 月 15 日停止服务，十三年的追剧打卡、评分和片单随之消失。如果你当初导出了数据，几分钟就能搬到 Seriez：导入文件、保留记录，之后电影、剧集和动画都在同一个资料库里管理。",
  ctaPrimary: "免费创建账号",
  ctaSecondary: "前往导入 CSV",
  ctaOther: "也记录电影？看看和 Letterboxd 的对比",
  section1: {
    title: "把 TV Time 的记录搬过来",
    lead: "直接使用 TV Time 导出的文件，不需要改格式，也不需要第三方工具。",
    items: [
      {
        t: "找到你导出的 CSV",
        b: "TV Time 提供两个文件：剧集和单集是 tracking-prod-records-v2.csv，电影是 tracking-prod-records.csv。如果错过了导出期限，文件已经不在了，但你仍然可以在这里重新开始。",
      },
      {
        t: "创建 Seriez 账号",
        b: "免费，也不需要去应用商店下载。在手机上把 Seriez 添加到主屏幕，就能像应用一样打开。",
      },
      {
        t: "在设置里导入文件",
        b: "进入设置、数据、导入 CSV，把文件放进去。看过的单集、评分和收藏会进入资料库，正在追的剧集进度会从 TV Time 停下的地方继续。",
      },
    ],
  },
  section2: {
    title: "能带过来的和带不过来的",
    cols: [
      {
        title: "可以带过来",
        items: ["所有标记为看过的单集", "看到一半的剧集进度", "记录过的电影", "你的评分和收藏"],
      },
      {
        title: "无法带过来",
        items: ["单集评论和表情反馈", "GIF 帖子和社区讨论", "关注者和旧有的个人主页"],
      },
    ],
    note:
      "这些内容 TV Time 从未导出，服务器也已经不存在，任何服务都无法恢复。你能做的是在这里重新开始对话：每个作品都有评论区，你的评分也会成为别人发现新作品的依据。",
  },
  section3: {
    title: "大家为什么搬到这里",
    items: [
      {
        t: "电影、剧集、动画，一个资料库。",
        b: "Letterboxd 只覆盖电影。Seriez 把三者放在一起，你不用再维护两三个分开的片单。",
      },
      {
        t: "真正准确的动画信息。",
        b: "动画数据来自 AniList，季数和集数是真实结构，而不是从剧集数据库里推测出来的。",
      },
      {
        t: "精确到单集的进度。",
        b: "看一集勾一集，随时知道这一季看到哪里，和 TV Time 培养出来的习惯完全一致。",
      },
      {
        t: "基于评分的推荐。",
        b: "For You 会读取你的观看记录来推荐下一部，而不是给所有访客同一份热门榜单。",
      },
      {
        t: "可以拿出去分享的年度总结。",
        b: "Golden Ticket 会员会得到年度总结，包含观看时长、常看类型和评分最高的作品。",
      },
    ],
  },
  section4: {
    title: "和其他替代服务相比",
    items: [
      {
        n: "Trakt",
        b: "运营多年的记录服务，媒体服务器集成和 API 都很强。适合已经在用 Plex 或 Kodi 的用户，部分功能属于付费 VIP。",
      },
      {
        n: "Simkl",
        b: "最接近 TV Time 手机端手感，支持从流媒体服务自动记录。七月用户集中涌入时服务器一度吃紧。",
      },
      {
        n: "Serializd",
        b: "Letterboxd 风格的剧集专门站，围绕评论和干净的动态流。只做剧集，所以电影和动画要放在别处。",
      },
      {
        n: "Bingers",
        b: "由 TV Time 的开发者打造，因此大量社区用户搬了过去。它的评论区最接近当年的分集讨论。",
      },
    ],
    note: "Seriez 是唯一把三类内容平等对待的服务，也是这份名单里唯一从 AniList 而不是电影剧集数据库获取动画数据的。",
  },
  faq: {
    title: "大家最先问的问题",
    items: [
      {
        q: "Seriez 免费吗？",
        a: "免费。创建账号、记录观看、评分、写评论、导入 TV Time 记录都不收费。Golden Ticket 是可选的付费方案，包含无限收藏、公开片单等附加功能。",
      },
      {
        q: "需要安装应用吗？",
        a: "不需要。Seriez 在浏览器里运行，也可以添加到手机主屏幕，像应用一样打开。没有需要从应用商店下载的东西。",
      },
      {
        q: "需要哪个 TV Time 文件？",
        a: "你从 TV Time 数据导出中拿到的 CSV。共有两个：tracking-prod-records-v2.csv(剧集和单集)和 tracking-prod-records.csv(电影)。在设置里依次导入即可。",
      },
      {
        q: "可以从 Trakt、IMDb 或 Letterboxd 导入吗？",
        a: "目前不能。现在支持的只有 TV Time 的 CSV。",
      },
      {
        q: "我在 TV Time 写的评论和反馈去哪了？",
        a: "随应用一起被删除了。TV Time 从未导出评论、GIF 反馈和社区讨论，所以任何服务都无法找回。能保留下来的是评分、观看记录和收藏。",
      },
      {
        q: "动画也能记录吗？",
        a: "可以。动画数据来自 AniList，季数和集数是准确的而不是推测的，并且和电影、剧集放在同一个资料库里。",
      },
    ],
  },
  final: {
    title: "从手上已有的文件开始",
    body: "创建账号、导入导出文件，几分钟资料库就回来了。如果当初没能拿到 TV Time 的数据，从空白开始也一样，记录方式完全相同。",
    cta: "免费创建账号",
    other: "看看和 Letterboxd 的对比",
  },
};

const zhLb: LandingCopy = {
  meta: {
    title: "能记剧集和动画的 Letterboxd 替代方案",
    description:
      "Letterboxd 只做电影。Seriez 在一个资料库里记录电影、剧集和动画，支持单集进度、评分、评论、收藏和年度总结。",
  },
  eyebrow: "LETTERBOXD 替代方案",
  h1: "喜欢 Letterboxd，但你并不只看电影？",
  lead: "Letterboxd 是专为电影设计的。于是看到第六季的剧集在一个应用里，动画在另一个应用里，电影留在这里。Seriez 把三者放进同一个资料库，保留你已经养成的记录习惯，并为剧集加上单集进度。",
  ctaPrimary: "免费创建账号",
  ctaSecondary: "我是从 TV Time 来的",
  ctaOther: "先随便看看",
  section1: {
    title: "看过的一切都在一个资料库",
    items: [
      {
        t: "电影该有的都有",
        b: "给看完的电影评分、写评论、标收藏、建片单。海报、演员表和片长来自 TMDB，和 Letterboxd 使用的电影数据来源相同。",
      },
      {
        t: "剧集精确到单集",
        b: "关注剧集，看一集勾一集，按季查看进度。新一季开播会出现在你的动态里，不用自己去查播出日期。",
      },
      {
        t: "动画来自 AniList",
        b: "动画有自己的一套季数和集数结构，电影数据库无法表达。Seriez 从 AniList 读取动画，所以分割播出不会变成重复条目或错误的集数。",
      },
      {
        t: "基于你记录的推荐",
        b: "For You 由你在三类内容里的评分和看完的作品构成，而不是给每位访客同一份榜单。",
      },
    ],
  },
  section2: {
    title: "Letterboxd 仍然更好的地方",
    body: "把这点讲清楚能省下你的时间。Letterboxd 有花十五年养成的电影写作文化和社区：评论像文章，片单自成一种文体，年度统计是很多人期待的东西。Seriez 更小、更新。如果影评和做片单是你去那里的理由，那部分仍然是 Letterboxd 更合适，这里也有很多人两个账号一起用。",
    body2:
      "Letterboxd 有意不做的是剧集和动画。这个空缺正是 Seriez 补上的部分。如果你的习惯是一部电影日记加五部剧集再加本季动画，一个资料库比三个省事。",
  },
  section4: {
    title: "直白地对比一下",
    items: [
      {
        n: "电影",
        b: "两边都可以。电影社区的厚度 Letterboxd 更强。Seriez 提供同样的记录功能，并把它放在你其他观看记录的旁边。",
      },
      {
        n: "带单集进度的剧集",
        b: "只有 Seriez。Letterboxd 只覆盖电影，所以没有单集记录功能。",
      },
      { n: "动画", b: "只有 Seriez，使用 AniList 真实的季数和集数结构。" },
      {
        n: "年度总结",
        b: "两边都有。这里的总结可以同时包含电影、剧集和动画，而不只是电影。",
      },
      {
        n: "导入已有记录",
        b: "目前还不能从 Letterboxd 导入。如果你是从 TV Time 来的，CSV 导入已经支持。",
      },
    ],
    note: "",
  },
  faq: {
    title: "大家最先问的问题",
    items: [
      {
        q: "Seriez 能完全替代 Letterboxd 吗？",
        a: "在记录和评分上可以，电影在这里得到同样的对待。Seriez 没有的是 Letterboxd 的电影写作文化、积累多年的片单和社区规模。很多人两个都留着，这是合理的选择。",
      },
      {
        q: "Seriez 记录剧集单集吗？",
        a: "记录。看一集勾一集，每部剧都会显示这一季看到了哪里。Letterboxd 只做电影，所以没有这个功能。",
      },
      {
        q: "动画是怎么记录的？",
        a: "动画来自 AniList，季数、集数和特别篇都遵循真实结构，而不是从电影剧集数据库推测。动画和你的电影、剧集共用一个资料库。",
      },
      {
        q: "可以导入我的 Letterboxd 记录吗？",
        a: "目前不能。现在只支持 TV Time 的 CSV 导入，Letterboxd 里的电影需要手动重新添加。",
      },
      {
        q: "免费吗？",
        a: "免费。账号、记录、评分、评论和留言都不收费。Golden Ticket 是可选的付费方案，包含无限收藏、公开片单和年度总结等功能。",
      },
    ],
  },
  final: {
    title: "把整个习惯收进一个地方",
    body: "给昨晚看的电影打分，勾掉今晚要看的这一集，再加上已经看到第三集的动画。一个资料库，一份年终总结。",
    cta: "免费创建账号",
    other: "先随便看看",
  },
};

const frTv: LandingCopy = {
  meta: {
    title: "Alternative à TV Time : conservez votre historique",
    description:
      "TV Time a fermé le 15 juillet 2026. Transférez votre historique vers Seriez en important le CSV de votre export, et suivez films, séries et animes au même endroit.",
  },
  eyebrow: "ALTERNATIVE À TV TIME",
  h1: "TV Time a fermé. Votre historique n'a pas à disparaître avec lui.",
  lead: "TV Time a fermé le 15 juillet 2026 et a emporté treize ans d'épisodes cochés, de notes et de listes. Si vous avez téléchargé vos données à temps, vous pouvez les amener sur Seriez en quelques minutes : importez le fichier, gardez votre historique et suivez désormais films, séries et animes dans une seule bibliothèque.",
  ctaPrimary: "Créer un compte gratuit",
  ctaSecondary: "Aller à Importer un CSV",
  ctaOther: "Vous regardez aussi des films ? Comparez avec Letterboxd",
  section1: {
    title: "Transférez votre historique TV Time",
    lead: "L'import prend le fichier tel qu'il est sorti de TV Time. Aucun reformatage, aucun outil externe.",
    items: [
      {
        t: "Retrouvez le CSV exporté",
        b: "TV Time envoyait deux fichiers : tracking-prod-records-v2.csv pour les séries et les épisodes, et tracking-prod-records.csv pour les films. Si vous avez manqué la période d'export, ces fichiers n'existent plus, mais vous pouvez démarrer une nouvelle bibliothèque ici.",
      },
      {
        t: "Créez votre compte Seriez",
        b: "C'est gratuit et il n'y a rien à télécharger depuis une boutique d'applications. Sur mobile, ajoutez Seriez à l'écran d'accueil pour l'ouvrir comme une application.",
      },
      {
        t: "Déposez le fichier dans Réglages",
        b: "Réglages, puis Données, puis Importer un CSV. Vos épisodes vus, vos notes et vos favoris arrivent dans votre bibliothèque, et les barres de progression reprennent là où TV Time les avait laissées.",
      },
    ],
  },
  section2: {
    title: "Ce qui suit et ce qui ne suit pas",
    cols: [
      {
        title: "Vient avec vous",
        items: [
          "Tous les épisodes marqués comme vus",
          "Les séries que vous suiviez",
          "Les films que vous aviez enregistrés",
          "Vos notes et vos favoris",
        ],
      },
      {
        title: "Ne peut pas suivre",
        items: ["Les commentaires et réactions par épisode", "Les fils de GIF et les publications de la communauté", "Les abonnés et votre ancien profil"],
      },
    ],
    note:
      "TV Time n'a jamais exporté ces éléments et ses serveurs n'existent plus : aucun service ne peut les restaurer. Ce que vous pouvez faire ici, c'est relancer les conversations : chaque titre a sa section de critiques, et vos notes nourrissent les découvertes des autres.",
  },
  section3: {
    title: "Pourquoi les gens viennent ici",
    items: [
      {
        t: "Films, séries et animes dans une bibliothèque.",
        b: "Letterboxd ne couvre que le cinéma. Seriez garde les trois ensemble, vous cessez donc de tenir deux ou trois listes séparées.",
      },
      {
        t: "Des animes enfin exacts.",
        b: "Les données d'anime viennent d'AniList : la structure des saisons et des épisodes est réelle, pas approximée à partir d'une base de données de séries.",
      },
      {
        t: "Une progression épisode par épisode.",
        b: "Cochez les épisodes à mesure et voyez où vous en êtes dans la saison, exactement l'habitude que TV Time avait installée.",
      },
      {
        t: "Des découvertes fondées sur vos notes.",
        b: "La section For You lit votre historique et propose quoi regarder ensuite, au lieu de montrer la même liste populaire à tout le monde.",
      },
      {
        t: "Un bilan annuel à montrer.",
        b: "Les membres Golden Ticket reçoivent un bilan de l'année avec les heures regardées, les genres principaux et vos titres les mieux notés.",
      },
    ],
  },
  section4: {
    title: "Où se situe Seriez parmi les alternatives",
    items: [
      {
        n: "Trakt",
        b: "Un tracker historique avec des intégrations poussées aux serveurs multimédias et une API solide. Idéal si vous passez déjà par Plex ou Kodi, avec certaines fonctions réservées à l'offre VIP payante.",
      },
      {
        n: "Simkl",
        b: "Le plus proche de la sensation mobile de TV Time, avec le suivi automatique depuis les plateformes de streaming. Ses serveurs ont souffert de l'afflux de juillet.",
      },
      {
        n: "Serializd",
        b: "Un foyer pour la télévision à la manière de Letterboxd, centré sur les critiques et un fil propre. Télévision uniquement, donc vos films et vos animes vivent ailleurs.",
      },
      {
        n: "Bingers",
        b: "Créé par le développeur derrière TV Time, ce qui explique que la communauté s'y soit largement déplacée. Ses commentaires sont ce qui ressemble le plus aux anciens fils par épisode.",
      },
    ],
    note: "Seriez est le seul à traiter les trois types de contenus à égalité, et le seul de cette liste où l'anime vient d'AniList et non d'une base de données de cinéma et de séries.",
  },
  faq: {
    title: "Les questions qui viennent d'abord",
    items: [
      {
        q: "Seriez est-il gratuit ?",
        a: "Oui. Créer un compte, suivre ce que vous regardez, noter, écrire des critiques et importer votre historique TV Time sont gratuits. Golden Ticket est une offre payante facultative pour des extras comme les collections illimitées et les listes publiées.",
      },
      {
        q: "Faut-il installer une application ?",
        a: "Non. Seriez fonctionne dans le navigateur et vous pouvez l'ajouter à l'écran d'accueil de votre téléphone pour l'ouvrir comme une application. Il n'y a rien à télécharger depuis une boutique.",
      },
      {
        q: "De quel fichier TV Time ai-je besoin ?",
        a: "Les CSV de votre export de données TV Time. Il y en a deux : tracking-prod-records-v2.csv pour les séries et les épisodes, et tracking-prod-records.csv pour les films. Importez-les l'un après l'autre dans Réglages.",
      },
      {
        q: "Puis-je aussi importer depuis Trakt, IMDb ou Letterboxd ?",
        a: "Pas aujourd'hui. L'import CSV de TV Time est le seul que Seriez prend en charge pour l'instant.",
      },
      {
        q: "Qu'est-il arrivé à mes commentaires et réactions TV Time ?",
        a: "Ils ont été supprimés avec l'application. TV Time n'a jamais exporté les commentaires, les réactions en GIF ni les fils de la communauté, donc aucun service ne peut les récupérer. Ce qui suit, ce sont les notes, l'historique et les favoris.",
      },
      {
        q: "Seriez suit-il aussi les animes ?",
        a: "Oui. Les données viennent d'AniList, donc les saisons et le nombre d'épisodes sont exacts et non devinés, et l'anime partage la bibliothèque de vos films et séries.",
      },
    ],
  },
  final: {
    title: "Commencez avec le fichier que vous avez déjà",
    body: "Créez un compte, importez votre export et votre bibliothèque revient en quelques minutes. Si vous n'avez jamais pu récupérer vos données de TV Time, commencez à vide : le suivi fonctionne de la même façon.",
    cta: "Créer un compte gratuit",
    other: "Voir la comparaison avec Letterboxd",
  },
};

const frLb: LandingCopy = {
  meta: {
    title: "Alternative à Letterboxd avec séries et animes",
    description:
      "Letterboxd, c'est le cinéma uniquement. Seriez suit films, séries et animes dans une seule bibliothèque, avec progression par épisode, notes, critiques, collections et bilan annuel.",
  },
  eyebrow: "ALTERNATIVE À LETTERBOXD",
  h1: "Vous aimez Letterboxd, mais vous ne regardez pas que des films ?",
  lead: "Letterboxd est consacré au cinéma, par choix. Résultat : la série dont vous regardez la sixième saison vit dans une application, l'anime dans une autre et les films ici. Seriez réunit les trois dans une bibliothèque, garde l'habitude du journal que vous avez déjà et ajoute la progression épisode par épisode pour les séries.",
  ctaPrimary: "Créer un compte gratuit",
  ctaSecondary: "J'arrive de TV Time",
  ctaOther: "D'abord jeter un œil",
  section1: {
    title: "Une bibliothèque pour tout ce que vous regardez",
    items: [
      {
        t: "Les films, avec l'essentiel",
        b: "Notez ce que vous terminez, écrivez une critique, marquez vos favoris et composez des collections. Affiches, distribution et durée viennent de TMDB, la même source que Letterboxd pour les données de films.",
      },
      {
        t: "Les séries, jusqu'à l'épisode",
        b: "Suivez vos séries, cochez les épisodes à mesure et voyez votre progression saison par saison. Quand une nouvelle saison démarre, elle arrive dans votre fil : plus besoin de chercher les dates de diffusion.",
      },
      {
        t: "Les animes, depuis AniList",
        b: "L'anime a sa propre structure de saisons et d'épisodes qu'une base de données de cinéma ne peut pas exprimer. Seriez lit l'anime depuis AniList : un split cour ne devient donc pas un doublon ni un mauvais nombre d'épisodes.",
      },
      {
        t: "Des recommandations qui utilisent votre historique",
        b: "La section For You se construit à partir de ce que vous avez noté et terminé, dans les trois types de contenus, au lieu de servir le même classement à chaque visiteur.",
      },
    ],
  },
  section2: {
    title: "Là où Letterboxd reste meilleur",
    body: "Être honnête là-dessus vous fait gagner du temps. Letterboxd possède une culture de l'écriture sur le cinéma et une communauté qui a mis quinze ans à se construire : les critiques sont des essais, les listes sont un genre à part et les statistiques annuelles sont attendues. Seriez est plus petit et plus récent. Si l'écriture sur le cinéma et les listes sont la raison de votre présence, Letterboxd reste le meilleur endroit pour cela, et beaucoup de gens ici gardent les deux comptes.",
    body2:
      "Ce que Letterboxd ne fait délibérément pas, c'est la télévision et l'anime. C'est ce vide que Seriez comble. Si votre habitude est un journal de films, plus cinq séries, plus l'anime de la saison, une bibliothèque vaut mieux que trois.",
  },
  section4: {
    title: "Comparaison directe, sans détour",
    items: [
      {
        n: "Films",
        b: "Les deux. Letterboxd a la communauté cinéma la plus profonde. Seriez propose les mêmes bases de suivi et les place à côté du reste de ce que vous regardez.",
      },
      {
        n: "Séries avec progression par épisode",
        b: "Seriez uniquement. Letterboxd couvre exclusivement le cinéma, c'est pourquoi le suivi des épisodes n'y existe pas.",
      },
      { n: "Animes", b: "Seriez uniquement, avec les données AniList et une vraie structure de saisons et d'épisodes." },
      {
        n: "Bilan annuel",
        b: "Les deux en proposent un. Celui d'ici peut couvrir films, séries et animes dans un seul bilan plutôt que le cinéma seul.",
      },
      {
        n: "Importer un historique existant",
        b: "L'import depuis Letterboxd n'existe pas encore. Celui du CSV de TV Time oui, si vous arrivez de là.",
      },
    ],
    note: "",
  },
  faq: {
    title: "Les questions qui viennent d'abord",
    items: [
      {
        q: "Seriez remplace-t-il complètement Letterboxd ?",
        a: "Pour le suivi et les notes, oui : les films y sont traités de la même manière. Ce que Seriez n'a pas, c'est la culture d'écriture sur le cinéma de Letterboxd, ses listes accumulées et la taille de sa communauté. Beaucoup de gens gardent les deux comptes, et c'est un choix raisonnable.",
      },
      {
        q: "Seriez suit-il les épisodes de séries ?",
        a: "Oui. Vous cochez les épisodes à mesure et chaque série indique où vous en êtes dans la saison. Letterboxd ne le fait pas parce qu'il ne couvre que le cinéma.",
      },
      {
        q: "Comment fonctionne le suivi des animes ?",
        a: "L'anime vient d'AniList : saisons, nombre d'épisodes et épisodes spéciaux suivent la structure réelle plutôt qu'une approximation issue d'une base de données de cinéma et de télévision. L'anime partage la bibliothèque de vos films et séries.",
      },
      {
        q: "Puis-je importer mon historique Letterboxd ?",
        a: "Pas aujourd'hui. L'import CSV de TV Time est le seul pris en charge pour l'instant : vos films Letterboxd devraient être ajoutés à la main.",
      },
      {
        q: "Est-ce gratuit ?",
        a: "Oui. Compte, suivi, notes, critiques et commentaires sont gratuits. Golden Ticket est une offre payante facultative pour des extras comme les collections illimitées, les listes publiées et le bilan annuel.",
      },
    ],
  },
  final: {
    title: "Ramenez toute l'habitude au même endroit",
    body: "Notez le film vu hier soir, cochez l'épisode de ce soir et ajoutez la saison d'anime dont vous avez vu trois épisodes. Une bibliothèque, un seul bilan en fin d'année.",
    cta: "Créer un compte gratuit",
    other: "D'abord jeter un œil",
  },
};

const deTv: LandingCopy = {
  meta: {
    title: "Alternative zu TV Time: Sehhistorie mitnehmen",
    description:
      "TV Time wurde am 15. Juli 2026 eingestellt. Importiere die CSV aus deinem Export und bring deine Sehhistorie zu Seriez, wo Filme, Serien und Anime an einem Ort liegen.",
  },
  eyebrow: "ALTERNATIVE ZU TV TIME",
  h1: "TV Time ist weg. Deine Sehhistorie muss nicht mitgehen.",
  lead: "TV Time wurde am 15. Juli 2026 eingestellt und nahm dreizehn Jahre abgehakte Episoden, Bewertungen und Listen mit. Wenn du deine Daten rechtzeitig exportiert hast, bringst du sie in wenigen Minuten zu Seriez: Datei importieren, Historie behalten und Filme, Serien und Anime ab jetzt in einer Bibliothek verfolgen.",
  ctaPrimary: "Kostenloses Konto erstellen",
  ctaSecondary: "Zum CSV-Import",
  ctaOther: "Du schaust auch Filme? Vergleiche mit Letterboxd",
  section1: {
    title: "Hol deine TV-Time-Historie herüber",
    lead: "Der Import nimmt die Datei genau so, wie sie aus TV Time kam. Kein Umformatieren, keine Fremdtools.",
    items: [
      {
        t: "Finde die exportierte CSV",
        b: "TV Time schickte zwei Dateien: tracking-prod-records-v2.csv für Serien und Episoden und tracking-prod-records.csv für Filme. Wenn du das Exportfenster verpasst hast, gibt es diese Dateien nicht mehr, aber du kannst hier eine neue Bibliothek beginnen.",
      },
      {
        t: "Erstelle dein Seriez-Konto",
        b: "Kostenlos und ohne Download aus einem App-Store. Auf dem Handy kannst du Seriez zum Startbildschirm hinzufügen, dann öffnet es sich wie eine App.",
      },
      {
        t: "Leg die Datei in den Einstellungen ab",
        b: "Einstellungen, dann Daten, dann CSV importieren. Deine gesehenen Episoden, Bewertungen und Favoriten landen in deiner Bibliothek, und die Fortschrittsbalken laufen dort weiter, wo TV Time sie gelassen hat.",
      },
    ],
  },
  section2: {
    title: "Was mitkommt und was nicht",
    cols: [
      {
        title: "Kommt mit",
        items: ["Alle Episoden, die du als gesehen markiert hast", "Serien, die du angefangen hattest", "Filme, die du erfasst hast", "Deine Bewertungen und Favoriten"],
      },
      {
        title: "Kann nicht mitkommen",
        items: ["Kommentare und Reaktionen pro Episode", "GIF-Threads und Community-Beiträge", "Follower und dein altes Profil"],
      },
    ],
    note:
      "Das hat TV Time nie exportiert, und die Server sind nicht mehr da. Kein Dienst kann es zurückholen. Was du hier tun kannst, ist die Gespräche neu starten: jeder Titel hat einen Rezensionsbereich, und deine Bewertungen füttern die Entdeckungen der anderen.",
  },
  section3: {
    title: "Warum Leute hierher wechseln",
    items: [
      {
        t: "Filme, Serien und Anime in einer Bibliothek.",
        b: "Letterboxd deckt nur Filme ab. Seriez hält alle drei zusammen, damit du nicht zwei oder drei getrennte Listen pflegen musst.",
      },
      {
        t: "Anime, die endlich stimmen.",
        b: "Die Anime-Daten kommen aus AniList, die Struktur von Staffeln und Episoden ist also echt und nicht aus einer Seriendatenbank geschätzt.",
      },
      {
        t: "Fortschritt bis zur einzelnen Episode.",
        b: "Hake Episoden beim Schauen ab und sieh, wie weit du in einer Staffel bist, genau die Gewohnheit, die TV Time aufgebaut hat.",
      },
      {
        t: "Empfehlungen aus deinen Bewertungen.",
        b: "Die For-You-Sektion liest deine Historie und schlägt vor, was als Nächstes dran ist, statt allen dieselbe Liste zu zeigen.",
      },
      {
        t: "Ein Jahresrückblick zum Zeigen.",
        b: "Golden-Ticket-Mitglieder bekommen einen Jahresrückblick mit Sehstunden, Top-Genres und ihren bestbewerteten Titeln.",
      },
    ],
  },
  section4: {
    title: "Wo Seriez zwischen den Alternativen steht",
    items: [
      {
        n: "Trakt",
        b: "Ein langjähriger Tracker mit tiefen Integrationen für Medienserver und einer starken API. Ideal, wenn dein Setup über Plex oder Kodi läuft, mit einigen Funktionen im kostenpflichtigen VIP-Tarif.",
      },
      {
        n: "Simkl",
        b: "Am nächsten am mobilen Gefühl von TV Time, mit automatischem Tracking aus Streaming-Diensten. Die Server kamen im Juli mit dem Ansturm kaum nach.",
      },
      {
        n: "Serializd",
        b: "Ein Zuhause für Fernsehen im Letterboxd-Stil, rund um Rezensionen und einen aufgeräumten Feed. Nur Fernsehen, deine Filme und Animes liegen also woanders.",
      },
      {
        n: "Bingers",
        b: "Vom Entwickler hinter TV Time gebaut, weshalb ein großer Teil der Community dorthin ging. Die Kommentarbereiche kommen den alten Episoden-Threads am nächsten.",
      },
    ],
    note: "Seriez ist der einzige Dienst, der alle drei Inhaltsarten gleich behandelt, und der einzige in dieser Liste, bei dem Anime aus AniList statt aus einer Film- und Seriendatenbank kommt.",
  },
  faq: {
    title: "Die häufigsten Fragen zuerst",
    items: [
      {
        q: "Ist Seriez kostenlos?",
        a: "Ja. Konto erstellen, Sehgewohnheiten erfassen, bewerten, rezensieren und deine TV-Time-Historie importieren sind kostenlos. Golden Ticket ist ein optionaler bezahlter Tarif für Extras wie unbegrenzte Sammlungen und veröffentlichte Listen.",
      },
      {
        q: "Muss ich eine App installieren?",
        a: "Nein. Seriez läuft im Browser, und du kannst es zum Startbildschirm deines Handys hinzufügen, damit es sich wie eine App öffnet. Aus einem App-Store gibt es nichts herunterzuladen.",
      },
      {
        q: "Welche TV-Time-Datei brauche ich?",
        a: "Die CSV-Dateien aus deinem TV-Time-Datenexport. Es waren zwei: tracking-prod-records-v2.csv für Serien und Episoden und tracking-prod-records.csv für Filme. Importiere sie nacheinander in den Einstellungen.",
      },
      {
        q: "Kann ich auch aus Trakt, IMDb oder Letterboxd importieren?",
        a: "Derzeit nicht. Der CSV-Import aus TV Time ist momentan der einzige, den Seriez unterstützt.",
      },
      {
        q: "Was ist mit meinen Kommentaren und Reaktionen bei TV Time passiert?",
        a: "Sie wurden mit der App gelöscht. TV Time hat Kommentare, GIF-Reaktionen und die Community-Threads nie exportiert, deshalb kann kein Dienst sie zurückholen. Bewertungen, Verlauf und Favoriten sind das, was mitkommt.",
      },
      {
        q: "Erfasst Seriez auch Anime?",
        a: "Ja. Die Anime-Daten stammen aus AniList, Staffeln und Episodenzahlen sind also korrekt und nicht geraten, und Anime liegt in derselben Bibliothek wie deine Filme und Serien.",
      },
    ],
  },
  final: {
    title: "Fang mit der Datei an, die du schon hast",
    body: "Konto erstellen, Export importieren, und deine Bibliothek ist in wenigen Minuten zurück. Wenn du deine Daten nie aus TV Time herausbekommen hast, starte leer: das Erfassen funktioniert genauso.",
    cta: "Kostenloses Konto erstellen",
    other: "Vergleich mit Letterboxd ansehen",
  },
};

const deLb: LandingCopy = {
  meta: {
    title: "Letterboxd-Alternative mit Serien und Anime",
    description:
      "Letterboxd deckt nur Filme ab. Seriez erfasst Filme, Serien und Anime in einer Bibliothek, mit Episodenfortschritt, Bewertungen, Rezensionen, Sammlungen und Jahresrückblick.",
  },
  eyebrow: "ALTERNATIVE ZU LETTERBOXD",
  h1: "Du magst Letterboxd, schaust aber nicht nur Filme?",
  lead: "Letterboxd ist bewusst nur für Filme gemacht. Also liegt die Serie, in der du in der sechsten Staffel bist, in einer App, der Anime in einer anderen und die Filme hier. Seriez bringt alle drei in eine Bibliothek, behält die Tagebuch-Gewohnheit, die du schon hast, und ergänzt Episodenfortschritt für Serien.",
  ctaPrimary: "Kostenloses Konto erstellen",
  ctaSecondary: "Ich komme von TV Time",
  ctaOther: "Erst mal umsehen",
  section1: {
    title: "Eine Bibliothek für alles, was du schaust",
    items: [
      {
        t: "Filme, mit allem Wichtigen",
        b: "Bewerte, was du beendest, schreibe eine Rezension, markiere Favoriten und baue Sammlungen. Poster, Besetzung und Laufzeit kommen aus TMDB, derselben Quelle, die Letterboxd für seine Filmdaten nutzt.",
      },
      {
        t: "Serien, bis zur Episode",
        b: "Folge Serien, hake Episoden beim Schauen ab und sieh deinen Fortschritt pro Staffel. Wenn eine neue Staffel startet, landet sie in deinem Feed, du musst also keine Startdaten suchen.",
      },
      {
        t: "Anime, aus AniList",
        b: "Anime haben ihre eigene Struktur aus Staffeln und Episoden, die eine Filmdatenbank nicht abbilden kann. Seriez liest Anime aus AniList, deshalb wird aus einem Split Cour kein Duplikat und keine falsche Episodenzahl.",
      },
      {
        t: "Empfehlungen aus deiner Historie",
        b: "Die For-You-Sektion entsteht aus dem, was du bewertet und beendet hast, über alle drei Inhaltsarten, statt allen Besuchern dieselbe Liste zu geben.",
      },
    ],
  },
  section2: {
    title: "Wo Letterboxd weiter besser ist",
    body: "Ehrlich zu sein spart dir Zeit. Letterboxd hat eine Schreibkultur zum Film und eine Community, die fünfzehn Jahre gebraucht hat: Die Rezensionen sind Essays, die Listen sind ein eigenes Genre, und die Jahresstatistiken werden erwartet. Seriez ist kleiner und neuer. Wenn Filmkritik und Listen das sind, weshalb du dort bist, bleibt Letterboxd der bessere Ort dafür, und viele hier führen beide Konten.",
    body2:
      "Was Letterboxd bewusst nicht macht, sind Fernsehen und Anime. Genau diese Lücke füllt Seriez. Wenn deine Gewohnheit ein Filmtagebuch plus fünf Serien plus der Anime der Saison ist, ist eine Bibliothek besser als drei.",
  },
  section4: {
    title: "Direkt nebeneinander verglichen",
    items: [
      {
        n: "Filme",
        b: "Beides. Letterboxd hat die tiefere Film-Community. Seriez bietet dieselben Grundlagen und stellt sie neben alles andere, was du schaust.",
      },
      {
        n: "Serien mit Episodenfortschritt",
        b: "Nur Seriez. Letterboxd deckt ausschließlich Filme ab, deshalb gibt es dort keine Episodenverfolgung.",
      },
      { n: "Anime", b: "Nur Seriez, mit Daten aus AniList und echter Staffel- und Episodenstruktur." },
      {
        n: "Jahresrückblick",
        b: "Beide bieten einen. Der hier kann Filme, Serien und Anime in einem Rückblick abdecken statt nur Filme.",
      },
      {
        n: "Bestehende Historie importieren",
        b: "Ein Import aus Letterboxd gibt es noch nicht. Der CSV-Import aus TV Time schon, falls du von dort kommst.",
      },
    ],
    note: "",
  },
  faq: {
    title: "Die häufigsten Fragen zuerst",
    items: [
      {
        q: "Ersetzt Seriez Letterboxd vollständig?",
        a: "Für Erfassen und Bewerten ja: Filme werden hier gleich behandelt. Was Seriez nicht hat, ist Letterboxds Schreibkultur zum Film, die über Jahre gewachsenen Listen und die Größe der Community. Viele führen beide Konten, und das ist eine vernünftige Wahl.",
      },
      {
        q: "Erfasst Seriez Serienepisoden?",
        a: "Ja. Du hakst Episoden beim Schauen ab, und jede Serie zeigt, wie weit du in der Staffel bist. Letterboxd macht das nicht, weil es nur Filme abdeckt.",
      },
      {
        q: "Wie funktioniert die Anime-Erfassung?",
        a: "Die Daten kommen aus AniList, Staffeln, Episodenzahlen und Specials folgen also der echten Struktur statt einer Schätzung aus einer Film- und Seriendatenbank. Anime liegt in derselben Bibliothek wie deine Filme und Serien.",
      },
      {
        q: "Kann ich meine Letterboxd-Historie importieren?",
        a: "Derzeit nicht. Der CSV-Import aus TV Time ist momentan der einzige, den Seriez unterstützt, deine Letterboxd-Filme müsstest du von Hand ergänzen.",
      },
      {
        q: "Ist es kostenlos?",
        a: "Ja. Konto, Erfassung, Bewertungen, Rezensionen und Kommentare sind kostenlos. Golden Ticket ist ein optionaler bezahlter Tarif für Extras wie unbegrenzte Sammlungen, veröffentlichte Listen und den Jahresrückblick.",
      },
    ],
  },
  final: {
    title: "Bring die ganze Gewohnheit an einen Ort",
    body: "Bewerte den Film von gestern Abend, hake die heutige Episode ab und ergänze die Anime-Staffel, in der du bei Folge drei bist. Eine Bibliothek, ein Rückblick am Jahresende.",
    cta: "Kostenloses Konto erstellen",
    other: "Erst mal umsehen",
  },
};

export const TV_TIME_COPY: Record<LandingLocale, LandingCopy> = {
  en: enTv,
  ko: koTv,
  ja: jaTv,
  zh: zhTv,
  fr: frTv,
  de: deTv,
  es: esTv,
  pt: ptTv,
};

export const LETTERBOXD_COPY: Record<LandingLocale, LandingCopy> = {
  en: enLb,
  ko: koLb,
  ja: jaLb,
  zh: zhLb,
  fr: frLb,
  de: deLb,
  es: esLb,
  pt: ptLb,
};

export const OG_LOCALES: Record<LandingLocale, string> = {
  en: "en_US",
  ko: "ko_KR",
  ja: "ja_JP",
  zh: "zh_CN",
  fr: "fr_FR",
  de: "de_DE",
  es: "es_ES",
  pt: "pt_BR",
};

export function landingCopy(map: Record<string, LandingCopy>, locale: string): LandingCopy {
  return map[locale] ?? map.en;
}
