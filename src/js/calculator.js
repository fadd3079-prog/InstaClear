function computeFinalTargets(datasetObject) {
  const followingSet = datasetObject.following || new Set();
  const followersSet = datasetObject.followers || new Set();
  const pendingRequestsSet = datasetObject.pendingRequests || new Set();
  const recentRequestsSet = datasetObject.recentRequests || new Set();
  const recentlyUnfollowedSet = datasetObject.recentlyUnfollowed || new Set();
  const removedSuggestionsSet = datasetObject.removedSuggestions || new Set();

  const notFollowingBack = new Set(
    [...followingSet].filter((username) => !followersSet.has(username))
  );

  const combinedWithPending = new Set([
    ...notFollowingBack,
    ...pendingRequestsSet,
  ]);

  const exclusionSet = new Set([
    ...recentRequestsSet,
    ...recentlyUnfollowedSet,
    ...removedSuggestionsSet,
  ]);

  const finalTargets = [...combinedWithPending]
    .filter((username) => !exclusionSet.has(username))
    .sort((usernameA, usernameB) => usernameA.localeCompare(usernameB));

  return finalTargets;
}

export { computeFinalTargets };
