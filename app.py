from __future__ import annotations

import re
from collections import defaultdict
from pathlib import Path

import networkx as nx
import pandas as pd
from flask import Flask, jsonify, render_template, request

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

app = Flask(__name__, static_folder="static", template_folder="templates")


def normalize_username(value: object) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    cleaned = str(value).strip().lower().replace(" ", "_")
    cleaned = re.sub(r"[^a-z0-9_.-]", "", cleaned)
    return cleaned


def parse_connection_cell(value: object) -> list[str]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return []
    if isinstance(value, list):
        return [normalize_username(item) for item in value if normalize_username(item)]
    text = str(value)
    if not text:
        return []
    replacements = {";": ",", "|": ",", "\n": ",", "\r": ","}
    for source, target in replacements.items():
        text = text.replace(source, target)
    parts = [item.strip() for item in text.split(",")]
    names = []
    for part in parts:
        username = normalize_username(part)
        if username:
            names.append(username)
    return names


def load_people_profiles() -> tuple[dict[str, str], dict[str, set[str]]]:
    profiles: dict[str, str] = {}
    connections: dict[str, set[str]] = defaultdict(set)

    def register_person(username: str, display_name: str | None = None) -> None:
        normalized = normalize_username(username)
        if not normalized:
            return
        profiles.setdefault(normalized, display_name or normalized.replace("_", " ").title())
        connections[normalized]

    def add_relation(source: str, target: str) -> None:
        src = normalize_username(source)
        dst = normalize_username(target)
        if not src or not dst or src == dst:
            return
        register_person(src)
        register_person(dst)
        connections[src].add(dst)
        connections[dst].add(src)

    people_csv = DATA_DIR / "people.csv"
    if people_csv.exists():
        dataframe = pd.read_csv(people_csv)
        for _, row in dataframe.iterrows():
            username = row.get("username") or row.get("user") or row.get("name")
            display_name = row.get("display_name") or row.get("displayName") or row.get("full_name")
            normalized = normalize_username(username)
            if normalized:
                register_person(normalized, str(display_name) if pd.notna(display_name) else None)
                for key in ("connections", "followers", "friends", "connected_to"):
                    if key in dataframe.columns:
                        friends = parse_connection_cell(row.get(key))
                        for friend in friends:
                            add_relation(normalized, friend)
                        break

    users_dir = DATA_DIR / "users"
    if users_dir.exists():
        for csv_file in sorted(users_dir.glob("*.csv")):
            base_name = normalize_username(csv_file.stem)
            register_person(base_name, base_name.replace("_", " ").title())
            df = pd.read_csv(csv_file)
            if df.empty:
                continue
            follower_columns = [col for col in df.columns if col.lower() in {"followers", "friends", "connections", "people"}]
            if follower_columns:
                for _, row in df.iterrows():
                    for column in follower_columns:
                        for friend in parse_connection_cell(row.get(column)):
                            add_relation(base_name, friend)
            else:
                for _, row in df.iterrows():
                    for value in row.tolist():
                        for friend in parse_connection_cell(value):
                            add_relation(base_name, friend)

    connections_csv = DATA_DIR / "connections.csv"
    if connections_csv.exists():
        df = pd.read_csv(connections_csv)
        if {"source", "target"}.issubset(df.columns):
            for _, row in df.iterrows():
                add_relation(row.get("source"), row.get("target"))
        else:
            for _, row in df.iterrows():
                if row.get("source") and row.get("target"):
                    add_relation(row.get("source"), row.get("target"))
                else:
                    source = row.get("person") or row.get("username") or row.get("user")
                    friends = row.get("followers") or row.get("friends") or row.get("connections")
                    if source:
                        for friend in parse_connection_cell(friends):
                            add_relation(source, friend)

    if not profiles:
        default_profile_data = {
            "rahul": "Rahul Sharma",
            "priya": "Priya Nair",
            "ananya": "Ananya Verma",
            "arjun": "Arjun Kumar",
            "neha": "Neha Rao",
            "rita": "Rita Sethi",
            "vikas": "Vikas Malhotra",
            "meera": "Meera Joshi",
            "kiran": "Kiran Patel",
            "zoya": "Zoya Khan",
            "harsh": "Harsh Singh",
            "tanvi": "Tanvi Gupta",
        }
        profiles.update(default_profile_data)
        for person, connections_list in {
            "rahul": ["priya", "ananya", "arjun", "neha"],
            "priya": ["rahul", "ananya", "meera", "rita"],
            "ananya": ["rahul", "priya", "kiran", "harsh"],
            "arjun": ["rahul", "neha", "vikas"],
            "neha": ["rahul", "arjun", "rita", "zoya"],
            "rita": ["priya", "neha", "meera"],
            "vikas": ["arjun", "meera", "kiran"],
            "meera": ["priya", "rita", "vikas", "tanvi"],
            "kiran": ["ananya", "vikas", "tanvi", "zoya"],
            "zoya": ["neha", "kiran", "harsh"],
            "harsh": ["ananya", "zoya", "tanvi"],
            "tanvi": ["meera", "kiran", "harsh"],
        }.items():
            for friend in connections_list:
                add_relation(person, friend)

    return profiles, connections


def build_graph() -> nx.Graph:
    profiles, connection_map = load_people_profiles()
    graph = nx.Graph()
    for username, display_name in profiles.items():
        graph.add_node(username, username=username, display_name=display_name)

    for username, neighbors in connection_map.items():
        for neighbor in neighbors:
            if username == neighbor:
                continue
            if not graph.has_node(neighbor):
                graph.add_node(neighbor, username=neighbor, display_name=neighbor.replace("_", " ").title())
            graph.add_edge(username, neighbor)
    return graph


def node_summary(graph: nx.Graph, username: str) -> dict:
    degree = graph.degree(username)
    component = nx.node_connected_component(graph, username)
    component_size = len(component)
    friends = sorted(graph.neighbors(username))
    display_name = graph.nodes[username].get("display_name") or username.replace("_", " ").title()
    return {
        "id": username,
        "username": username,
        "display_name": display_name,
        "degree": degree,
        "friends": friends,
        "connected_component_size": component_size,
    }


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/graph")
def graph_api():
    graph = build_graph()
    nodes = []
    for username in sorted(graph.nodes()):
        metadata = graph.nodes[username]
        nodes.append(
            {
                "id": username,
                "username": username,
                "displayName": metadata.get("display_name") or username.replace("_", " ").title(),
                "degree": graph.degree(username),
                "connectedComponentSize": len(nx.node_connected_component(graph, username)),
            }
        )

    edges = []
    seen = set()
    for source, target in sorted(graph.edges()):
        edge_id = f"{source}-{target}"
        reverse = f"{target}-{source}"
        if edge_id in seen or reverse in seen:
            continue
        seen.add(edge_id)
        edges.append({"id": edge_id, "source": source, "target": target})

    return jsonify({"nodes": nodes, "edges": edges})


@app.route("/api/person/<username>")
def person_api(username: str):
    graph = build_graph()
    normalized = normalize_username(username)
    if normalized not in graph:
        return jsonify({"error": "Person not found."}), 404

    profile = node_summary(graph, normalized)
    target = request.args.get("with")
    mutual_friends = []
    if target:
        target_username = normalize_username(target)
        if target_username in graph:
            mutual_friends = sorted(set(graph.neighbors(normalized)) & set(graph.neighbors(target_username)))

    detail = {
        "id": normalized,
        "username": normalized,
        "display_name": profile["display_name"],
        "degree": profile["degree"],
        "friends": profile["friends"],
        "connected_component_size": profile["connected_component_size"],
        "mutual_friends": mutual_friends,
    }
    return jsonify(detail)


@app.route("/api/search")
def search_api():
    query = request.args.get("query", "").strip().lower()
    if not query:
        return jsonify([])

    graph = build_graph()
    matches = []
    for username in sorted(graph.nodes()):
        if query in username or query in (graph.nodes[username].get("display_name") or "").lower():
            matches.append(
                {
                    "id": username,
                    "username": username,
                    "display_name": graph.nodes[username].get("display_name") or username.replace("_", " ").title(),
                    "degree": graph.degree(username),
                }
            )
    return jsonify(matches[:20])


@app.route("/api/path")
def path_api():
    source = normalize_username(request.args.get("source", ""))
    target = normalize_username(request.args.get("target", ""))

    graph = build_graph()
    if not source or not target:
        return jsonify({"error": "Both source and target are required."}), 400
    if source not in graph or target not in graph:
        return jsonify({"error": "One or both users could not be found in the graph."}), 404

    if source == target:
        return jsonify({"path": [source], "distance": 0, "mutual_friends": []})

    try:
        path = nx.shortest_path(graph, source, target)
        mutual_friends = sorted(set(graph.neighbors(source)) & set(graph.neighbors(target)))
        return jsonify({"path": path, "distance": len(path) - 1, "mutual_friends": mutual_friends})
    except nx.NetworkXNoPath:
        return jsonify({"path": [], "distance": None, "mutual_friends": []})


@app.route("/api/mutual")
def mutual_api():
    source = normalize_username(request.args.get("source", ""))
    target = normalize_username(request.args.get("target", ""))
    graph = build_graph()

    if source not in graph or target not in graph:
        return jsonify({"error": "One or both users could not be found."}), 404

    mutual_friends = sorted(set(graph.neighbors(source)) & set(graph.neighbors(target)))
    return jsonify({"source": source, "target": target, "mutual_friends": mutual_friends})


@app.route("/api/suggestions")
def suggestion_api():
    username = normalize_username(request.args.get("username", ""))
    graph = build_graph()

    if not username or username not in graph:
        return jsonify([])

    friends = set(graph.neighbors(username))
    suggestions = []
    for person in graph.nodes():
        if person == username or person in friends:
            continue
        shared = len(set(graph.neighbors(person)) & friends)
        if shared > 0:
            suggestions.append(
                {
                    "username": person,
                    "display_name": graph.nodes[person].get("display_name") or person.replace("_", " ").title(),
                    "shared_connections": shared,
                    "degree": graph.degree(person),
                }
            )
    suggestions.sort(key=lambda item: (-item["shared_connections"], -item["degree"], item["username"]))
    return jsonify(suggestions[:10])


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
