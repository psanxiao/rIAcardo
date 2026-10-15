"""Storage helpers for in-app notifications."""

DATABASE_SCHEMA = "public"


def create_notification(conn, user_id: str, title: str, message: str = None,
                        type_: str = "system", link: str = None) -> dict:
    """Inserts a notification for a user and returns its id / creation time."""
    with conn.cursor() as cursor:
        cursor.execute(
            f"""INSERT INTO {DATABASE_SCHEMA}.notifications (user_id, type, title, message, link)
                VALUES (%s, %s, %s, %s, %s) RETURNING id, created_at""",
            (user_id, type_, title, message, link),
        )
        row = cursor.fetchone()
    conn.commit()
    return {"id": row[0], "created_at": str(row[1])}


def _row_to_dict(row) -> dict:
    return {
        "id": row[0],
        "type": row[1],
        "title": row[2],
        "message": row[3],
        "link": row[4],
        "is_read": row[5],
        "created_at": str(row[6]),
    }


def list_notifications(conn, user_id: str, limit: int = 50, unread_only: bool = False) -> list:
    """Returns the most recent notifications for a user, newest first."""
    query = (
        f"SELECT id, type, title, message, link, is_read, created_at "
        f"FROM {DATABASE_SCHEMA}.notifications WHERE user_id = %s"
    )
    if unread_only:
        query += " AND is_read = FALSE"
    query += " ORDER BY created_at DESC LIMIT %s"

    with conn.cursor() as cursor:
        cursor.execute(query, (user_id, limit))
        return [_row_to_dict(row) for row in cursor.fetchall()]


def count_unread(conn, user_id: str) -> int:
    """Number of unread notifications for a user."""
    with conn.cursor() as cursor:
        cursor.execute(
            f"SELECT COUNT(*) FROM {DATABASE_SCHEMA}.notifications WHERE user_id = %s AND is_read = FALSE",
            (user_id,),
        )
        return cursor.fetchone()[0]


def mark_as_read(conn, user_id: str, notification_id: int) -> bool:
    """Marks a single notification as read. Returns False if it doesn't exist."""
    with conn.cursor() as cursor:
        cursor.execute(
            f"UPDATE {DATABASE_SCHEMA}.notifications SET is_read = TRUE WHERE id = %s AND user_id = %s",
            (notification_id, user_id),
        )
        updated = cursor.rowcount
    conn.commit()
    return updated > 0


def mark_all_as_read(conn, user_id: str) -> int:
    """Marks every unread notification as read. Returns the number updated."""
    with conn.cursor() as cursor:
        cursor.execute(
            f"UPDATE {DATABASE_SCHEMA}.notifications SET is_read = TRUE WHERE user_id = %s AND is_read = FALSE",
            (user_id,),
        )
        updated = cursor.rowcount
    conn.commit()
    return updated
