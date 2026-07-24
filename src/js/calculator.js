function normalizeForComparison(username) {
  if (!username) return '';
  return String(username).toLowerCase().trim();
}

function computeFinalTargets(datasetObject) {
  const followingArray = Array.from(datasetObject.following || []);
  const followersArray = Array.from(datasetObject.followers || []);
  const pendingArray = Array.from(datasetObject.pendingRequests || []);
  const recentArray = Array.from(datasetObject.recentRequests || []);
  const unfollowedArray = Array.from(datasetObject.recentlyUnfollowed || []);
  const removedArray = Array.from(datasetObject.removedSuggestions || []);

  const exclusionSet = new Set([
    ...followersArray,
    ...pendingArray,
    ...recentArray,
    ...unfollowedArray,
    ...removedArray
  ].map(normalizeForComparison));

  const validFollowing = followingArray.map(normalizeForComparison).filter(Boolean);
  
  const finalTargets = [...new Set(validFollowing)]
    .filter((username) => !exclusionSet.has(username))
    .sort((usernameA, usernameB) => usernameA.localeCompare(usernameB));

  if (finalTargets.length > validFollowing.length) {
    console.error('Calculation error: Final targets exceed total following count.');
    return finalTargets.slice(0, validFollowing.length);
  }

  return finalTargets;
}

export { computeFinalTargets };
