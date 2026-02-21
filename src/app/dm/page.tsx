"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import styles from "./dm.module.css";

type Conversation = {
  threadId: number;
  partnerId: number;
  partnerName: string;
  preview: string;
  time: string;
  unread: boolean;
  online: boolean;
};

type ChatMessage = {
  id: number;
  content: string;
  isMine: boolean;
};

type DmResponse = {
  currentUserId: number;
  activeThreadId: number | null;
  activePartnerName: string;
  conversations: Conversation[];
  messages: ChatMessage[];
};

export default function DmPage() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [messageText, setMessageText] = useState("");
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [activePartnerName, setActivePartnerName] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const noteItems = [
    "思いを伝えよう",
    "ドバイチョコ動画見ちまった",
    "おっ！",
    "いやだ🥺🙏",
    "Ⅲ フランス語",
  ];


  const applyDmData = useCallback((data: DmResponse) => {
    setActiveThreadId(data.activeThreadId);
    setActivePartnerName(data.activePartnerName);
    setConversations(data.conversations);
    setMessages(data.messages);
  }, []);

  const loadDmData = useCallback(async (threadId?: number) => {
    setLoading(true);
    setError("");

    try {
      const query = threadId ? `?threadId=${threadId}` : "";
      const res = await fetch(`/api/dm${query}`, { cache: "no-store" });

      if (!res.ok) {
        throw new Error("DMデータの取得に失敗しました");
      }

      const data = (await res.json()) as DmResponse;
      if (threadId) {
        applyDmData(data);
      } else {
        setConversations(data.conversations);
        setActiveThreadId(null);
        setActivePartnerName("");
        setMessages([]);
      }
    } catch {
      setError("DMの読み込み中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [applyDmData]);

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeThreadId || !messageText.trim() || sending) {
      return;
    }

    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/dm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threadId: activeThreadId,
          content: messageText,
        }),
      });

      if (!res.ok) {
        throw new Error("送信失敗");
      }

      const data = (await res.json()) as DmResponse;
      applyDmData(data);
      setMessageText("");
    } catch {
      setError("メッセージ送信に失敗しました");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    loadDmData();
  }, [loadDmData]);

  return (
    <div className={styles.page}>
      <main className={styles.shell}>
        <aside className={styles.iconRail}>
          <div className={styles.railTop}>
            <Link href="/feed" className={styles.railIcon}>🏠</Link>
            <span className={styles.railIcon}>🔍</span>
            <span className={styles.railIcon}>➕</span>
            <span className={styles.railIcon}>🧭</span>
            <span className={styles.railIcon}>❤️</span>
            <Link href="/dm" className={styles.railIcon}>💬</Link>
          </div>
          <div className={styles.railBottom}>
            <Link href="/profile">
              <div 
                className={styles.railAvatar}
                style={{
                  backgroundImage: "url('/image_1.png')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  border: "none",
                  backgroundColor: "transparent",
                  color: "transparent"
                }}
              ></div>
            </Link>
            <span className={styles.railIcon}>≡</span>
          </div>
        </aside>

        <aside className={styles.leftPane}>
          <div className={styles.leftHeader}>
            <span className={styles.accountName}>otn_s</span>
            <button className={styles.composeButton}>✎</button>
          </div>

          <div className={styles.searchWrap}>
            <input className={styles.searchInput} placeholder="検索" />
          </div>

          <div className={styles.noteStrip}>
            {noteItems.map((note) => (
              <div key={note} className={styles.noteItem}>
                <div className={styles.noteBubble}>{note}</div>
                <div className={styles.noteAvatar}></div>
              </div>
            ))}
          </div>

          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>メッセージ</span>
            <span className={styles.sectionLink}>リクエスト</span>
          </div>

          <div className={styles.threadList}>
            {loading && <p className={styles.infoText}>読み込み中...</p>}
            {!loading && error && <p className={styles.errorText}>{error}</p>}
            {!loading && !error && conversations.length === 0 && (
              <p className={styles.infoText}>会話がまだありません</p>
            )}

            {!loading &&
              !error &&
              conversations.map((item) => (
                <button
                  key={item.threadId}
                  className={`${styles.threadItem} ${item.threadId === activeThreadId ? styles.activeThread : ""}`}
                  onClick={() => loadDmData(item.threadId)}
                >
                  <div className={styles.threadAvatarWrap}>
                    <div className={styles.threadAvatar}>{item.partnerName.charAt(0).toUpperCase()}</div>
                    {item.unread && <span className={styles.unreadBadge} />}
                  </div>

                  <div className={styles.threadContent}>
                    <p className={styles.threadName}>{item.partnerName}</p>
                    <p className={styles.threadMeta}>
                      {item.preview} ・ {item.time}
                    </p>
                  </div>
                </button>
              ))}
          </div>
        </aside>

        <section className={styles.chatPane}>
          {!activeThreadId ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>✈</div>
              <h2 className={styles.emptyTitle}>メッセージ</h2>
              <p className={styles.emptyText}>
                友達やグループに非公開で写真やメッセージを送信できます。
              </p>
              <button className={styles.emptyButton}>メッセージを送信</button>
            </div>
          ) : (
            <>
              <div className={styles.chatTop}>
                <div className={styles.chatTopUser}>
                  <div className={styles.chatTopAvatar}>
                    {(activePartnerName || "-").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className={styles.chatTopName}>{activePartnerName}</p>
                  </div>
                </div>
                <div className={styles.chatTopInfo}>ⓘ</div>
              </div>

              <div className={styles.chatMessages}>
                {!loading && !error && messages.length === 0 && (
                  <p className={styles.infoText}>表示できるメッセージがありません</p>
                )}
                {!loading && !error && messages.length > 0 && (
                  <p className={styles.messageTime}>3:15 PM</p>
                )}
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`${styles.chatRow} ${message.isMine ? styles.mine : styles.theirs}`}
                  >
                    <div className={styles.chatBubble}>{message.content}</div>
                  </div>
                ))}
              </div>

              <form className={styles.chatInputBar} onSubmit={handleSendMessage}>
                <input
                  type="text"
                  placeholder="メッセージを入力"
                  className={styles.chatInput}
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  disabled={sending}
                />
                <button
                  type="submit"
                  className={styles.chatSend}
                  disabled={!messageText.trim() || sending}
                >
                  {sending ? "送信中..." : "Send"}
                </button>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
