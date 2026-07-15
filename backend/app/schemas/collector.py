from pydantic import BaseModel, HttpUrl


class CollectUrlRequest(BaseModel):
    url: HttpUrl
    update_existing: bool = False
    use_browser: bool = False
    ignore_https_errors: bool = False


class CollectUrlResponse(BaseModel):
    url: str
    status_code: int
    title: str | None
    text_preview: str

    emails: list[str]
    phones: list[str]
    dates: list[str]
    cities: list[str]

class CollectedLink(BaseModel):
    text: str
    url: str


class CollectLinksResponse(BaseModel):
    page_url: str
    links: list[CollectedLink]

class CrawlRequest(BaseModel):
    url: HttpUrl
    max_depth: int = 2
    max_pages: int = 20
    use_browser: bool = True
    ignore_https_errors: bool = False


class CrawledPageResponse(BaseModel):
    url: str
    status_code: int
    depth: int


class CrawlResponse(BaseModel):
    start_url: str
    pages: list[CrawledPageResponse]
    documents: list[CollectedLink]