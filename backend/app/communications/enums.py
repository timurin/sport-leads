from enum import Enum


class CommunicationChannel(str, Enum):
    EMAIL = "email"
    TELEGRAM = "telegram"
    WHATSAPP = "whatsapp"
    VK = "vk"
    WEBSITE = "website"
    PHONE = "phone"
    INTERNAL = "internal"


class MessageDirection(str, Enum):
    INCOMING = "incoming"
    OUTGOING = "outgoing"


class MessageStatus(str, Enum):
    DRAFT = "draft"
    QUEUED = "queued"
    SENDING = "sending"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"
